const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const {
  normalizeEmail,
  normalizeIndianPhone,
  isValidEmail,
  isValidIndianPhone,
} = require("../utils/identityUtils");

dotenv.config();

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

async function run() {
  await connectDB();

  const users = await User.find({}).lean();

  const issues = {
    totalUsers: users.length,
    duplicateEmails: [],
    duplicatePhones: [],
    emptyEmails: [],
    invalidEmails: [],
    emptyPhones: [],
    invalidPhones: [],
    whitespaceEmail: [],
    caseVariantEmail: [],
    phoneFormattingVariants: [],
    missingFirebaseUid: [],
    suspectedDuplicateRecords: [],
  };

  const normalizedRecords = users.map((user) => {
    const rawEmail =
      user.email === undefined || user.email === null ? "" : String(user.email);
    const rawPhone =
      user.phone === undefined || user.phone === null ? "" : String(user.phone);
    const normalizedEmail = normalizeEmail(rawEmail);
    const normalizedPhone = normalizeIndianPhone(rawPhone);

    if (!user.firebaseUid || !String(user.firebaseUid).trim()) {
      issues.missingFirebaseUid.push({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
      });
    }

    if (!rawEmail.trim()) {
      issues.emptyEmails.push({
        _id: user._id,
        fullName: user.fullName,
        firebaseUid: user.firebaseUid,
      });
    } else {
      if (!isValidEmail(rawEmail)) {
        issues.invalidEmails.push({
          _id: user._id,
          email: rawEmail,
          normalizedEmail,
        });
      }
      if (rawEmail !== rawEmail.trim()) {
        issues.whitespaceEmail.push({
          _id: user._id,
          email: rawEmail,
          suggested: normalizedEmail,
        });
      }
      if (rawEmail.trim() !== rawEmail.trim().toLowerCase()) {
        issues.caseVariantEmail.push({
          _id: user._id,
          email: rawEmail,
          suggested: normalizedEmail,
        });
      }
    }

    if (!rawPhone.trim()) {
      issues.emptyPhones.push({
        _id: user._id,
        fullName: user.fullName,
        firebaseUid: user.firebaseUid,
      });
    } else {
      if (!isValidIndianPhone(rawPhone)) {
        issues.invalidPhones.push({
          _id: user._id,
          phone: rawPhone,
          normalizedPhone,
        });
      }
      if (rawPhone.trim() !== normalizedPhone) {
        issues.phoneFormattingVariants.push({
          _id: user._id,
          phone: rawPhone,
          suggested: normalizedPhone,
        });
      }
    }

    return {
      _id: user._id,
      firebaseUid: user.firebaseUid,
      fullName: user.fullName,
      email: rawEmail,
      phone: rawPhone,
      normalizedEmail,
      normalizedPhone,
    };
  });

  const emailGroups = groupBy(
    normalizedRecords,
    (item) => item.normalizedEmail,
  );
  for (const [email, group] of emailGroups.entries()) {
    if (!email) continue;
    if (group.length > 1) {
      issues.duplicateEmails.push({
        normalizedEmail: email,
        users: group.map((u) => ({
          _id: u._id,
          firebaseUid: u.firebaseUid,
          fullName: u.fullName,
          email: u.email,
        })),
      });
    }
  }

  const phoneGroups = groupBy(
    normalizedRecords,
    (item) => item.normalizedPhone,
  );
  for (const [phone, group] of phoneGroups.entries()) {
    if (!phone) continue;
    if (group.length > 1) {
      issues.duplicatePhones.push({
        normalizedPhone: phone,
        users: group.map((u) => ({
          _id: u._id,
          firebaseUid: u.firebaseUid,
          fullName: u.fullName,
          phone: u.phone,
        })),
      });
    }
  }

  const byNameAndPhone = groupBy(
    normalizedRecords,
    (item) =>
      `${(item.fullName || "").trim().toLowerCase()}|${item.normalizedPhone}`,
  );
  for (const [key, group] of byNameAndPhone.entries()) {
    if (group.length > 1 && key !== "|") {
      issues.suspectedDuplicateRecords.push({
        key,
        users: group.map((u) => ({
          _id: u._id,
          firebaseUid: u.firebaseUid,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone,
        })),
      });
    }
  }

  const summary = {
    totalUsers: issues.totalUsers,
    duplicateEmailGroups: issues.duplicateEmails.length,
    duplicatePhoneGroups: issues.duplicatePhones.length,
    emptyEmails: issues.emptyEmails.length,
    invalidEmails: issues.invalidEmails.length,
    emptyPhones: issues.emptyPhones.length,
    invalidPhones: issues.invalidPhones.length,
    whitespaceEmail: issues.whitespaceEmail.length,
    caseVariantEmail: issues.caseVariantEmail.length,
    phoneFormattingVariants: issues.phoneFormattingVariants.length,
    missingFirebaseUid: issues.missingFirebaseUid.length,
    suspectedDuplicateRecords: issues.suspectedDuplicateRecords.length,
  };

  console.log(JSON.stringify({ summary, issues }, null, 2));
  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error("Audit failed:", error);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  process.exit(1);
});
