# Tutor Link

Premium login and registration flow for a university tutoring marketplace.

## Run the API

1. Copy `Backend/.env.example` to `Backend/.env`.
2. Add your MongoDB URL as `MONGODB_URI` and set a long random `JWT_SECRET`.
3. Run `cd Backend`, then `npm run dev`.

The API runs on `http://localhost:5000` by default. Available endpoints:

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`

## Run the mobile app

1. Copy `mobile/.env.example` to `mobile/.env`.
2. Set `EXPO_PUBLIC_API_URL` to the API URL.
3. Run `cd mobile`, then `npm start`.

For Android Emulator, the default `http://10.0.2.2:5000/api` works. For a physical phone, use your computer's LAN IP, for example `http://192.168.1.10:5000/api`.

The standard Expo Go workflow remains available with `cd mobile` then `npm run start:go`. Jitsi meetings use an Expo development build because the Jitsi SDK contains native modules. See [docs/jitsi-meetings.md](docs/jitsi-meetings.md) for the complete local/EAS build commands and architecture notes.

Confirmed booking classrooms also include authenticated real-time chat. Messages are stored in MongoDB, delivered to the learner and tutor through Socket.IO, and linked to the booking's secured Jitsi meeting action. Socket.IO runs on the same port as the Express API, so no additional chat server command is required.

Google sign-in and password reset are intentionally shown as configuration placeholders until OAuth and email-provider credentials are supplied.

Matching backend APIs live in `Backend/src/routes`, with MongoDB models in `Backend/src/models`.

Create or update an administrator securely with:

```powershell
cd Backend
npm run create-admin -- admin@example.com "a-strong-password"
```
HCI Module

---

## 👨‍💻 Team Members

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/PabodaWA">
        <img src="https://github.com/PabodaWA.png" width="100px;" alt="Paboda Medhani"/>
        <br />
        <sub><b>Paboda Medhani</b></sub>
      </a>
      <br />
      <sub>Full Stack Developer</sub>
      <br />
      <a href="https://github.com/PabodaWA">GitHub</a>
    </td>
    <td align="center">
      <a href="https://github.com/Lasiru71">
        <img src="https://github.com/Lasiru71.png" width="100px;" alt="Lasiru"/>
        <br />
        <sub><b>Lasiru</b></sub>
      </a>
      <br />
      <sub>Full Stack Developer</sub>
      <br />
      <a href="https://github.com/Lasiru71">GitHub</a>
    </td>
    <td align="center">
      <a href="https://github.com/hiruniNwijesinghe">
        <img src="https://github.com/hiruniNwijesinghe.png" width="100px;" alt="Hiruni"/>
        <br />
        <sub><b>Hiruni</b></sub>
      </a>
      <br />
      <sub>Full Stack Developer</sub>
      <br />
      <a href="https://github.com/hiruniNwijesinghe">GitHub</a>
    </td>
  

---
