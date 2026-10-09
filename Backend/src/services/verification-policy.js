function verificationIdentityChanged(existing, name, qualifications) {
  return (name !== undefined && name !== existing.name) ||
    (qualifications !== undefined && JSON.stringify(qualifications) !== JSON.stringify(existing.profile?.qualifications || []));
}

module.exports = { verificationIdentityChanged };
