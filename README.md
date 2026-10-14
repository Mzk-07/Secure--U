# SecureU — Student Safety, Wellbeing & Smart Campus

SecureU is a simple BCA-level Progressive Web App for student safety and campus assistance. It keeps the existing safety/wellbeing features and adds one connected **Smart Campus Companion**.

## New integrated Smart Campus features
- **Smart Campus Search** — search library, rooms, faculty, HOD, canteen, labs and offices.
- **Where Am I?** — select the current building/room and see nearby places.
- **Where Should I Go?** — type a request such as “I need my Java teacher” and SecureU finds the matching person/place.
- **Scan & Find** — camera-ready screen plus room selection for the demo; can later be connected to QR/vision recognition.
- **Senior Knowledge Hub** — academic, campus, faculty and resource tips.
- **New Student Mode** — first-week guide, important places, faculty help, campus basics and emergency shortcuts.

The demo uses an imaginary college called **ABC University – Smart Campus**. Replace the campus data in `script.js` with your real college details later.

## Firebase connection (no Firebase)
This version removes the old Firebase/Apps Script dependency.

### 1. Firebase Web app config
Open `firebase-config.js` and replace the placeholder values with the Web app configuration from Firebase Console → Project settings → Your apps → Web app. The project id is already set to `u-5b1d3`.

### 2. Enable Authentication
Firebase Console → Authentication → Sign-in method → enable **Email/Password**.

Students can keep using Gmail addresses; SecureU checks Gmail in the front-end. Firebase provides the actual password authentication.

### 3. Create Firestore Database
Firebase Console → Firestore Database → Create database.

### 4. Add Firestore rules
Copy the contents of `firebase-rules.txt` into Firestore → Rules → Publish.

### 5. Create the admin account
In Firebase Console → Authentication → Users, create an admin email/password account. Copy that user's UID.

In Firestore, create:
`admins / <ADMIN-UID>`

Example document:
```
role: "admin"
name: "SecureU Administrator"
```

### 6. Admin panel
Open `admin.html`. Sign in with the Firebase admin account. The panel reads **reports** and **feedback** directly from Firestore. No Firebase or Apps Script is required.

## Firestore collections
- `profiles/{uid}` — optional student profile data
- `reports/{documentId}` — issue reports
- `feedback/{documentId}` — anonymous feedback
- `admins/{uid}` — admin access marker

Reports and feedback are still saved to localStorage first, so the app remains usable offline. When Firebase is configured and online, submissions are also copied to Firestore.

## Hosting
The project can be hosted on Firebase Hosting. After adding your Firebase config, deploy the folder normally.

## Important
The campus names, faculty names and room numbers are **imaginary demo data**. Replace them before using the project as real campus information.
