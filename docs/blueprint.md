# **App Name**: koli smaj inam vitaran

## Core Features:

- Secure User Authentication: Implement Firebase Authentication for secure access, managing separate login flows for data entry center users and administrators.
- AI-Powered Data Extraction: Utilize Gemini Vision AI as a tool to intelligently extract student name, total marks, obtained marks, and infer academic stream/degree from Marksheet images, and village name from Aadhar card images.
- Optimized Document Uploads: Provide client-side image compression for Marksheet and Aadhar photo uploads, ensuring file sizes are between 500-600KB before storage in Firebase Storage to manage costs.
- Interactive Data Entry Form: A user-friendly form with auto-filled data from AI extraction, allowing data entry personnel to verify and edit information before final submission to Firebase Firestore.
- Admin Analytics Dashboard: A protected administrative view displaying live analytics such as total submissions and distribution of students by class or data entry center, sourced efficiently from Firestore.
- Student Profile Management: An admin-exclusive feature to search, view, and edit student profiles and associated document images with paginated lists, ensuring optimized Firebase Firestore queries.

## Style Guidelines:

- Primary color: A deep, professional blue (#2360DB), symbolizing reliability and clarity for the portal's main interactive elements.
- Background color: A soft, light blue-grey (#EAEFF5) provides a clean and readable canvas for displaying student data and forms.
- Accent color: A vibrant yet thoughtful purple (#683CF5) to draw attention to call-to-action buttons and important alerts without being overwhelming.
- All text uses 'Inter', a grotesque sans-serif font known for its modern, clean, and highly legible appearance across all screen sizes and data densities.
- Utilize a consistent set of crisp, modern line-based icons for navigation, actions (e.g., upload, edit, save), and status indicators, aligning with the clean aesthetic of TailwindCSS.
- Employ a responsive and modular grid-based layout designed with TailwindCSS, ensuring optimal readability and usability across various devices, from desktop to mobile views, for both data entry and administrative functions.
- Subtle and functional animations for user feedback, such as loading indicators during data fetching or form submission, and smooth transitions between dashboard views to enhance the user experience.