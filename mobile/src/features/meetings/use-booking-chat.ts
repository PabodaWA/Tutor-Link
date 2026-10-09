import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

import { apiOrigin, apiRequest } from '@/services/api';

export type BookingChatMessage = {
  id: string;
  bookingId: string;
  text: string;
  sender: {
    id: string;
    name: string;
    role: 'student' | 'tutor' | 'admin';
    avatarUrl?: string;
  };
  createdAt: string;
};

type ConnectionState = 'connecting' | 'live' | 'offline';
export type ConversationType = 'booking' | 'tutor-request';

function mergeMessages(current: BookingChatMessage[], incoming: BookingChatMessage[]) {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((left, right) => (
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  ));
}

export function useBookingChat(bookingId?: string, token?: string | null, conversationType: ConversationType = 'booking') {
  const [messages, setMessages] = useState<BookingChatMessage[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>(bookingId && token ? 'connecting' : 'offline');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!bookingId || !token) return;

    let active = true;
    const reset = setTimeout(() => {
      setMessages([]);
      setError('');
      setConnectionState('connecting');
    }, 0);

    apiRequest<{ messages: BookingChatMessage[] }>(`/messages/${conversationType}/${bookingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((result) => {
        if (active) setMessages((current) => mergeMessages(current, result.messages));
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load this conversation.');
      });

    const socket = io(apiOrigin(), {
      auth: { token },
      forceNew: true,
      reconnection: true,
    });

    socket.on('connect', () => {
      setConnectionState('connecting');
      const event = conversationType === 'booking' ? 'booking:join' : 'tutor-request:join';
      const payload = conversationType === 'booking' ? { bookingId } : { tutorRequestId: bookingId };
      socket.timeout(5000).emit(event, payload, (timeoutError: Error | null, result?: { ok: boolean; error?: string }) => {
        if (!active) return;
        if (timeoutError || !result?.ok) {
          setConnectionState('offline');
          setError(result?.error || 'Could not synchronize this conversation.');
          return;
        }
        setConnectionState('live');
        setError('');
      });
    });
    socket.on('disconnect', () => active && setConnectionState('offline'));
    socket.on('connect_error', (reason) => {
      if (!active) return;
      setConnectionState('offline');
      setError(reason.message || 'Real-time chat is temporarily unavailable.');
    });
    socket.on('message:new', (message: BookingChatMessage) => {
      if (active && message.bookingId === bookingId) {
        setMessages((current) => mergeMessages(current, [message]));
      }
    });

    return () => {
      active = false;
      clearTimeout(reset);
      socket.disconnect();
    };
  }, [bookingId, conversationType, token]);

  const sendMessage = useCallback(async (text: string) => {
    if (!bookingId || !token) throw new Error('This conversation is not available.');
    try {
      setSending(true);
      setError('');
      const result = await apiRequest<{ message: BookingChatMessage }>(`/messages/${conversationType}/${bookingId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      setMessages((current) => mergeMessages(current, [result.message]));
      return result.message;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not send this message.';
      setError(message);
      throw reason;
    } finally {
      setSending(false);
    }
  }, [bookingId, conversationType, token]);

  return { messages, connectionState, error, sending, sendMessage };
}
