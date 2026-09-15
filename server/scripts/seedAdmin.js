const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const connectDB = require("../config/db");
const User = require("../models/User");

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, "../.env") });

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
    } else if (
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
    } else if (process.env.FIREBASE_DATABASE_URL) {
      admin.initializeApp({
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
    }
  } catch (error) {
    console.warn("⚠️ Firebase Admin initialization warning:", error.message);
  }
}

async function seedAdmin() {
  try {
    await connectDB();

    const adminEmail = (process.env.ADMIN_EMAIL || "admin@shivikalibrary.com").toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || "AdminSecure123!";
    const adminName = process.env.ADMIN_NAME || "Library Administrator";
    const adminPhone = process.env.ADMIN_PHONE || "9999999999";

    console.log(`🔑 Provisioning Admin Account: ${adminEmail}...`);

    let firebaseUid;

    // Check / create Firebase user
    try {
      const fbUser = await admin.auth().getUserByEmail(adminEmail);
      firebaseUid = fbUser.uid;
      console.log(`✅ Existing Firebase Admin user found: ${firebaseUid}`);
    } catch (fbError) {
      if (fbError.code === "auth/user-not-found") {
        console.log("➕ Creating new Admin user in Firebase Auth...");
        const newFbUser = await admin.auth().createUser({
          email: adminEmail,
          password: adminPassword,
          displayName: adminName,
        });
        firebaseUid = newFbUser.uid;
        console.log(`✅ Created Firebase Admin user: ${firebaseUid}`);
      } else {
        console.warn("⚠️ Could not interact with Firebase Auth (proceeding with local DB check):", fbError.message);
        firebaseUid = `admin-uid-${Date.now()}`;
      }
    }

    // Check / update MongoDB Admin user
    let user = await User.findOne({ $or: [{ email: adminEmail }, { firebaseUid }, { phone: adminPhone }] });

    if (user) {
      user.role = "admin";
      user.fullName = adminName;
      user.email = adminEmail;
      user.firebaseUid = firebaseUid;
      await user.save();
      console.log(`✅ Updated existing user record to role: "admin" (${user.email})`);
    } else {
      user = new User({
        firebaseUid,
        fullName: adminName,
        email: adminEmail,
        phone: adminPhone,
        provider: "email",
        role: "admin",
        isActive: true,
      });
      await user.save();
      console.log(`✅ Created new MongoDB Admin record with role: "admin" (${user.email})`);
    }

    console.log("");
    console.log("============================================");
    console.log("🎉 ADMIN ACCOUNT SUCCESSFULLY PROVISIONED");
    console.log("============================================");
    console.log(`  📧 Email:    ${adminEmail}`);
    console.log(`  🔑 Password: ${adminPassword}`);
    console.log(`  👑 Role:     admin`);
    console.log("============================================");

    process.exit(0);
  } catch (error) {
    console.error("❌ Admin seeding failed:", error);
    process.exit(1);
  }
}

seedAdmin();
