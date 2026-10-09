const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
  password: { type: String, minlength: 8, select: false },
  googleId: { type: String, unique: true, sparse: true, select: false },
  avatarUrl: { type: String, trim: true, maxlength: 500 },
  role: { type: String, enum: ['student', 'tutor', 'admin'], default: 'student' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  isVerified: { type: Boolean, default: false },
  verificationStatus: { type: String, enum: ['not_requested', 'pending', 'verified', 'rejected'], default: 'not_requested' },
  verificationNote: { type: String, trim: true, maxlength: 300 },
  verificationReviewedAt: { type: Date },
  verificationReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  onboardingCompleted: { type: Boolean, default: false },
  creditBalance: { type: Number, default: 0, min: 0 },
  redeemedCreditCodes: [{ type: String, trim: true, uppercase: true }],
  profile: {
    interests: [{ type: String, trim: true }],
    studyLevel: { type: String, trim: true },
    learningGoal: { type: String, trim: true },
    preferredSubject: { type: String, trim: true, maxlength: 50 },
    currentProficiency: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'] },
    learningStyles: [{ type: String, enum: ['Step-by-step', 'Interactive', 'Visual examples', 'Exam prep', 'Online', 'Physical', 'Group'] }],
    tutorMatchGoal: { type: String, trim: true, maxlength: 150 },
    subjects: [{ type: String, trim: true }],
    experience: { type: String, trim: true },
    hourlyRate: { type: Number, min: 0, max: 100000 },
    bio: { type: String, trim: true, maxlength: 500 },
    qualifications: [{ type: String, trim: true }],
    verificationDocuments: [{ type: String, trim: true }],
    verificationFiles: [{
      id: { type: String, required: true },
      name: { type: String, required: true, maxlength: 180 },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true },
    }],
  },
}, { timestamps: true });

userSchema.set('toJSON', {
  transform: (_document, result) => {
    delete result.password;
    delete result.__v;
    delete result.redeemedCreditCodes;
    return result;
  },
});

module.exports = mongoose.model('User', userSchema);
