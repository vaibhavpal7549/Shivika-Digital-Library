const admin = require("firebase-admin");
const User = require("../models/User");

function parseBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;

  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}

async function requireFirebaseAuth(req, res, next) {
  try {
    const token = parseBearerToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.auth = {
      uid: decoded.uid,
      token: decoded,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired authentication token",
    });
  }
}

function requireUidMatch({ bodyField, paramField } = {}) {
  return (req, res, next) => {
    if (!req.auth?.uid) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const valuesToCheck = [];

    if (bodyField) {
      valuesToCheck.push(req.body?.[bodyField]);
    }

    if (paramField) {
      valuesToCheck.push(req.params?.[paramField]);
    }

    const hasMismatch = valuesToCheck
      .filter(Boolean)
      .some((value) => String(value) !== req.auth.uid);

    if (hasMismatch) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to perform this action for another user",
      });
    }

    next();
  };
}

async function requireAdmin(req, res, next) {
  try {
    if (!req.auth?.uid) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const user = await User.findOne({ firebaseUid: req.auth.uid });

    if (!user || user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Failed to verify admin permissions",
    });
  }
}

module.exports = {
  requireFirebaseAuth,
  requireUidMatch,
  requireAdmin,
};
