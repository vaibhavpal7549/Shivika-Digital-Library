const dotenv = require("dotenv");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const connectDB = require("../config/db");
const User = require("../models/User");
const {
  normalizeEmail,
  normalizeIndianPhone,
} = require("../utils/identityUtils");

dotenv.config();

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) return;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    return;
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    return;
  }

  throw new Error(
    "Firebase Admin credentials are not configured in environment variables",
  );
}

async function listAllAuthUsers() {
  const users = [];
  let nextPageToken;

  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    users.push(...result.users);
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  return users;
}

async function run() {
  initializeFirebaseAdmin();
  await connectDB();

  const [mongoUsers, authUsers] = await Promise.all([
    User.find({}).lean(),
    listAllAuthUsers(),
  ]);

  const mongoByUid = new Map(mongoUsers.map((u) => [u.firebaseUid, u]));
  const authByUid = new Map(authUsers.map((u) => [u.uid, u]));

  const authOnly = [];
  const mongoOnly = [];
  const emailConflicts = [];
  const phoneConflicts = [];
  const profileMismatches = [];

  for (const authUser of authUsers) {
    if (!mongoByUid.has(authUser.uid)) {
      authOnly.push({
        uid: authUser.uid,
        email: authUser.email || null,
        phoneNumber: authUser.phoneNumber || null,
        disabled: !!authUser.disabled,
      });
      continue;
    }

    const mongoUser = mongoByUid.get(authUser.uid);
    const authEmail = normalizeEmail(authUser.email || "");
    const mongoEmail = normalizeEmail(mongoUser.email || "");

    if (authEmail && mongoEmail && authEmail !== mongoEmail) {
      profileMismatches.push({
        uid: authUser.uid,
        type: "email_mismatch",
        authEmail,
        mongoEmail,
      });
    }

    const authPhone = normalizeIndianPhone(authUser.phoneNumber || "");
    const mongoPhone = normalizeIndianPhone(mongoUser.phone || "");

    if (authPhone && mongoPhone && authPhone !== mongoPhone) {
      profileMismatches.push({
        uid: authUser.uid,
        type: "phone_mismatch",
        authPhone,
        mongoPhone,
      });
    }
  }

  for (const mongoUser of mongoUsers) {
    if (!authByUid.has(mongoUser.firebaseUid)) {
      mongoOnly.push({
        _id: mongoUser._id,
        firebaseUid: mongoUser.firebaseUid,
        email: mongoUser.email,
        phone: mongoUser.phone,
        fullName: mongoUser.fullName,
      });
    }
  }

  const authEmailMap = new Map();
  for (const authUser of authUsers) {
    const email = normalizeEmail(authUser.email || "");
    if (!email) continue;
    if (!authEmailMap.has(email)) authEmailMap.set(email, []);
    authEmailMap.get(email).push(authUser.uid);
  }

  const mongoEmailMap = new Map();
  for (const mongoUser of mongoUsers) {
    const email = normalizeEmail(mongoUser.email || "");
    if (!email) continue;
    if (!mongoEmailMap.has(email)) mongoEmailMap.set(email, []);
    mongoEmailMap.get(email).push(mongoUser.firebaseUid);
  }

  for (const [email, authUids] of authEmailMap.entries()) {
    const mongoUids = mongoEmailMap.get(email) || [];
    const combined = new Set([...authUids, ...mongoUids]);
    if (combined.size > 1) {
      emailConflicts.push({
        normalizedEmail: email,
        authUids,
        mongoUids,
      });
    }
  }

  const authPhoneMap = new Map();
  for (const authUser of authUsers) {
    const phone = normalizeIndianPhone(authUser.phoneNumber || "");
    if (!phone) continue;
    if (!authPhoneMap.has(phone)) authPhoneMap.set(phone, []);
    authPhoneMap.get(phone).push(authUser.uid);
  }

  const mongoPhoneMap = new Map();
  for (const mongoUser of mongoUsers) {
    const phone = normalizeIndianPhone(mongoUser.phone || "");
    if (!phone) continue;
    if (!mongoPhoneMap.has(phone)) mongoPhoneMap.set(phone, []);
    mongoPhoneMap.get(phone).push(mongoUser.firebaseUid);
  }

  for (const [phone, authUids] of authPhoneMap.entries()) {
    const mongoUids = mongoPhoneMap.get(phone) || [];
    const combined = new Set([...authUids, ...mongoUids]);
    if (combined.size > 1) {
      phoneConflicts.push({
        normalizedPhone: phone,
        authUids,
        mongoUids,
      });
    }
  }

  const report = {
    summary: {
      mongoUsers: mongoUsers.length,
      authUsers: authUsers.length,
      authOnly: authOnly.length,
      mongoOnly: mongoOnly.length,
      emailConflicts: emailConflicts.length,
      phoneConflicts: phoneConflicts.length,
      profileMismatches: profileMismatches.length,
    },
    authOnly,
    mongoOnly,
    emailConflicts,
    phoneConflicts,
    profileMismatches,
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error("Reconciliation failed:", error.message);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  process.exit(1);
});
