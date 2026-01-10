const { google } = require('googleapis');

/**
 * ============================================
 * GOOGLE SHEETS SERVICE
 * ============================================
 * 
 * Handles all Google Sheets API operations for real-time sync.
 * Uses Service Account authentication.
 * 
 * SETUP REQUIRED:
 * 1. Create Google Cloud Project
 * 2. Enable Google Sheets API
 * 3. Create Service Account
 * 4. Download credentials JSON
 * 5. Share your Google Sheet with service account email
 * 6. Set environment variables:
 *    - GOOGLE_SHEETS_SPREADSHEET_ID
 *    - GOOGLE_SERVICE_ACCOUNT_EMAIL
 *    - GOOGLE_PRIVATE_KEY (from credentials JSON)
 * 
 * SHEET STRUCTURE:
 * Sheet 1: "Users" - All user data
 * Sheet 2: "Payments" - Payment transactions
 * Sheet 3: "Seats" - Seat status overview
 */

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    this.initialized = false;
    this.initError = null;
  }

  /**
   * Initialize Google Sheets API client
   */
  async initialize() {
    try {
      // Check required environment variables
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        console.warn('⚠️  Google Sheets credentials not configured');
        console.warn('   Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY');
        this.initError = 'Credentials not configured';
        return false;
      }

      if (!this.spreadsheetId) {
        console.warn('⚠️  GOOGLE_SHEETS_SPREADSHEET_ID not set');
        this.initError = 'Spreadsheet ID not configured';
        return false;
      }

      // Create auth client
      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      // Initialize sheets API
      this.sheets = google.sheets({ version: 'v4', auth });
      this.initialized = true;
      console.log('✅ Google Sheets service initialized');

      // Ensure sheet headers exist
      await this.ensureSheetHeaders();

      return true;
    } catch (error) {
      console.error('❌ Google Sheets initialization failed:', error.message);
      this.initError = error.message;
      return false;
    }
  }

  /**
   * Ensure sheet headers are set up
   */
  async ensureSheetHeaders() {
    if (!this.initialized) return;

    try {
      // Users sheet headers
      const usersHeaders = [
        'ID', 'Full Name', 'Phone', 'Email', 'Seat Number', 'Shift',
        'Payment Status', 'Total Paid', 'Last Payment', 'Next Due Date',
        'Seat Status', 'Expiry Date', 'Updated At'
      ];

      // Payments sheet headers
      const paymentsHeaders = [
        'Payment ID', 'User Name', 'Phone', 'Email', 'Seat Number',
        'Amount', 'Payment Mode', 'Status', 'Months Paid', 'Paid At',
        'Valid Until', 'Receipt Number'
      ];

      // Check if headers exist in Users sheet
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: 'Users!A1:M1',
        valueInputOption: 'RAW',
        requestBody: { values: [usersHeaders] }
      });

      // Check if Payments sheet exists and add headers
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: 'Payments!A1:L1',
        valueInputOption: 'RAW',
        requestBody: { values: [paymentsHeaders] }
      });

      console.log('✅ Google Sheets headers verified');
    } catch (error) {
      // Sheet might not exist, try to create it
      if (error.code === 400) {
        console.warn('⚠️  Please create "Users" and "Payments" sheets manually');
      }
      console.error('⚠️  Could not set headers:', error.message);
    }
  }

  /**
   * Sync user data to Google Sheets
   * Called when: user books seat, payment successful, admin updates
   */
  async syncUser(user) {
    if (!this.initialized) {
      console.warn('⚠️  Google Sheets not initialized, skipping sync');
      return { success: false, error: this.initError };
    }

    try {
      const syncData = user.getSheetsSyncData();
      const rowData = [
        user._id.toString(),
        syncData.fullName,
        syncData.phone,
        syncData.email,
        syncData.seatNumber,
        syncData.shift,
        syncData.paymentStatus,
        syncData.totalPaid,
        syncData.lastPaymentDate,
        syncData.nextDueDate,
        syncData.seatStatus,
        syncData.expiryDate,
        new Date().toISOString()
      ];

      // Check if user row exists
      if (user.sheetsSync?.sheetRowId) {
        // Update existing row
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `Users!A${user.sheetsSync.sheetRowId}:M${user.sheetsSync.sheetRowId}`,
          valueInputOption: 'RAW',
          requestBody: { values: [rowData] }
        });
        console.log(`✅ Updated user in Sheets: ${user.fullName} (row ${user.sheetsSync.sheetRowId})`);
      } else {
        // Append new row
        const response = await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: 'Users!A:M',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [rowData] }
        });

        // Extract row number from response
        const updatedRange = response.data.updates.updatedRange;
        const rowMatch = updatedRange.match(/Users!A(\d+)/);
        const rowId = rowMatch ? parseInt(rowMatch[1]) : null;

        // Update user with sheet row ID
        user.sheetsSync = {
          lastSyncedAt: new Date(),
          sheetRowId: rowId,
          syncStatus: 'synced'
        };
        await user.save();

        console.log(`✅ Added user to Sheets: ${user.fullName} (row ${rowId})`);
      }

      return { success: true, rowId: user.sheetsSync?.sheetRowId };
    } catch (error) {
      console.error('❌ Google Sheets sync failed:', error.message);
      
      // Update user sync status
      user.sheetsSync = {
        ...user.sheetsSync,
        syncStatus: 'failed'
      };
      await user.save();

      return { success: false, error: error.message };
    }
  }

  /**
   * Sync payment to Google Sheets
   * Called after successful payment verification
   */
  async syncPayment(payment) {
    if (!this.initialized) {
      console.warn('⚠️  Google Sheets not initialized, skipping payment sync');
      return { success: false, error: this.initError };
    }

    try {
      const syncData = payment.getSheetsSyncData();
      const rowData = [
        syncData.paymentId,
        syncData.userName,
        syncData.userPhone,
        syncData.userEmail,
        syncData.seatNumber,
        syncData.amount,
        syncData.paymentMode,
        syncData.status,
        syncData.monthsPaid,
        syncData.paidAt,
        syncData.validUntil,
        syncData.receiptNumber
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Payments!A:L',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowData] }
      });

      // Mark payment as synced
      payment.sheetsSynced = true;
      await payment.save();

      console.log(`✅ Payment synced to Sheets: ${payment.paymentId || payment.orderId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Payment sync to Sheets failed:', error.message);
      payment.syncError = error.message;
      await payment.save();
      return { success: false, error: error.message };
    }
  }

  /**
   * Update specific user row by finding their ID
   */
  async updateUserRow(userId, updateData) {
    if (!this.initialized) return { success: false, error: this.initError };

    try {
      // Find the row with this user ID
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Users!A:A'
      });

      const values = response.data.values || [];
      let rowIndex = -1;
      
      for (let i = 0; i < values.length; i++) {
        if (values[i][0] === userId.toString()) {
          rowIndex = i + 1; // Sheets are 1-indexed
          break;
        }
      }

      if (rowIndex === -1) {
        return { success: false, error: 'User not found in sheet' };
      }

      // Update specific cells based on updateData
      const updates = [];
      
      if (updateData.paymentStatus !== undefined) {
        updates.push({
          range: `Users!G${rowIndex}`,
          values: [[updateData.paymentStatus]]
        });
      }
      
      if (updateData.totalPaid !== undefined) {
        updates.push({
          range: `Users!H${rowIndex}`,
          values: [[updateData.totalPaid]]
        });
      }
      
      if (updateData.nextDueDate !== undefined) {
        updates.push({
          range: `Users!J${rowIndex}`,
          values: [[updateData.nextDueDate]]
        });
      }

      if (updateData.seatStatus !== undefined) {
        updates.push({
          range: `Users!K${rowIndex}`,
          values: [[updateData.seatStatus]]
        });
      }

      // Always update timestamp
      updates.push({
        range: `Users!M${rowIndex}`,
        values: [[new Date().toISOString()]]
      });

      // Batch update
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates
        }
      });

      console.log(`✅ Updated user row ${rowIndex} in Sheets`);
      return { success: true, rowIndex };
    } catch (error) {
      console.error('❌ Failed to update user row:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Batch sync multiple users (for scheduled jobs)
   */
  async batchSyncUsers(users) {
    if (!this.initialized) return { success: false, error: this.initError };

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const user of users) {
      const result = await this.syncUser(user);
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({ userId: user._id, error: result.error });
      }
    }

    console.log(`📊 Batch sync complete: ${results.success} success, ${results.failed} failed`);
    return results;
  }

  /**
   * Get all data from Users sheet (for admin dashboard)
   */
  async getAllUsers() {
    if (!this.initialized) return { success: false, error: this.initError };

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Users!A:M'
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) {
        return { success: true, users: [] };
      }

      const headers = rows[0];
      const users = rows.slice(1).map(row => {
        const user = {};
        headers.forEach((header, index) => {
          user[header] = row[index] || '';
        });
        return user;
      });

      return { success: true, users };
    } catch (error) {
      console.error('❌ Failed to get users from Sheets:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete user row from sheet (when user is deleted)
   */
  async deleteUserRow(sheetRowId) {
    if (!this.initialized || !sheetRowId) return { success: false };

    try {
      // Get spreadsheet to find sheet ID
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      const usersSheet = spreadsheet.data.sheets.find(s => s.properties.title === 'Users');
      if (!usersSheet) return { success: false, error: 'Users sheet not found' };

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: usersSheet.properties.sheetId,
                dimension: 'ROWS',
                startIndex: sheetRowId - 1,
                endIndex: sheetRowId
              }
            }
          }]
        }
      });

      console.log(`✅ Deleted row ${sheetRowId} from Sheets`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to delete row:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark expired seats (yellow highlight) in sheet
   */
  async highlightExpiredSeats(userIds) {
    if (!this.initialized) return { success: false };

    // This would require using the Sheets API to apply formatting
    // For simplicity, we'll just update the status column
    for (const userId of userIds) {
      await this.updateUserRow(userId, {
        paymentStatus: 'OVERDUE',
        seatStatus: 'expired'
      });
    }

    return { success: true };
  }
}

// Export singleton instance
const googleSheetsService = new GoogleSheetsService();
module.exports = googleSheetsService;
