const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ==============================
// 🌐 CORS (Render + GitHub Pages)
// ==============================
app.use(cors({
  origin: 'https://athena-ataltinkeringlab.github.io',  // NOTE: no /Payslip.html
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// define upload BEFORE using it
const upload = multer({ dest: 'uploads/' });

// ==============================
// 📊 Upload & Parse Excel
// ==============================
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded');

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(sheet);

    res.json({ data });
  } catch (err) {
    console.error('UPLOAD ERROR:', err);
    res.status(500).send('Error reading Excel file');
  }
});

// ==============================
// 📧 Send Emails with PDF
// ==============================
app.post('/send-emails', async (req, res) => {
  try {
    const { branch, employees } = req.body;

    if (!branch || !Array.isArray(employees)) {
      return res.status(400).send('Missing branch or employees array');
    }

    let emailUser, emailPass, fromName;
    const b = String(branch).toLowerCase();

    if (b === 'chennai') {
      emailUser = process.env.CHENNAI_EMAIL_USER;
      emailPass = process.env.CHENNAI_EMAIL_PASS;
      fromName = 'Athena Global School - Chennai';
    } else if (b === 'chengalpattu') {
      emailUser = process.env.CHENG_EMAIL_USER;
      emailPass = process.env.CHENG_EMAIL_PASS;
      fromName = 'Athena Global School - Chengalpattu';
    } else if (b === 'chidambaram') {
      emailUser = process.env.CHID_EMAIL_USER;
      emailPass = process.env.CHID_EMAIL_PASS;
      fromName = 'Athena Global School - Chidambaram';
    } else {
      return res.status(400).send('Unknown branch');
    }

    if (!emailUser || !emailPass) {
      return res.status(500).send('Email credentials not configured for this branch');
    }

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  family: 4, // force IPv4
  auth: {
    user: emailUser,
    pass: emailPass,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  debug: true,   // 👈 ADD THIS
  logger: true,  // 👈 ADD THIS
});

await transporter.verify()
  .then(() => console.log("SMTP OK"))
  .catch(err => console.log("SMTP FAIL:", err));

    for (const emp of employees) {
      const toEmail = emp['Email'];
      const name = emp['Employee Name'] || '';
      const pdfBase64 = emp.pdf;

      if (!toEmail || !pdfBase64) {
        console.log('Skipping row (missing Email or pdf):', emp);
        continue;
      }

      const buffer = Buffer.from(
        pdfBase64.includes(',')
          ? pdfBase64.split(',')[1]
          : pdfBase64,
        'base64'
      );

      await transporter.sendMail({
        from: `"${fromName}" <${emailUser}>`,
        to: toEmail,
        subject: `Payslip - ${name}`,
        text: `Dear ${name},\n\nPlease find your payslip attached.\n\nRegards,\n${fromName}`,
        attachments: [
          {
            filename: `Payslip_${name || 'Employee'}.pdf`,
            content: buffer,
          },
        ],
      });
    }

    res.send('✅ All emails sent successfully!');
  } catch (err) {
    console.error('SEND-EMAILS ERROR:', err);
    res.status(500).send('❌ Error sending emails');
  }
});

// ==============================
// 🌐 Health Check Route
// ==============================
app.get('/', (req, res) => {
  res.send('🚀 Athena Payslip Backend Running');
});

// ==============================
// 🚀 Start Server (Render)
// ==============================
const PORT = process.env.PORT || 3000; // Render sets PORT automatically

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});