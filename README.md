SECURE FILE SHARING PLATFORM
3-WEEK DEVELOPMENT PLAN
TEAM SIZE: 4 MEMBERS

============================================================
1. PROJECT OVERVIEW
============================================================

Project Goal:
Build a secure file-sharing platform that allows users to upload,
store, share, and download files with controlled access, expiration,
encryption, and integrity verification.

Main Security Features:
- User authentication
- Role-based access control
- File encryption
- File-hash verification
- Password-protected sharing
- Expiring share links
- Download limits
- Share-link revocation
- Access/download logs
- Rate limiting
- File validation
- Security testing

Suggested Technology Stack:

Frontend:
- React
- Vite
- Tailwind CSS
- Axios
- React Router

Backend:
- Node.js
- Express.js
- JWT
- bcrypt or Argon2
- Helmet
- express-rate-limit

Database:
- PostgreSQL or MongoDB

Storage:
- Local encrypted storage for prototype
- S3-compatible storage can be added later

Cryptography:
- AES-256-GCM for file encryption
- SHA-256 for file integrity verification
- bcrypt/Argon2 for password hashing
- Cryptographically secure random tokens for share links


============================================================
2. TEAM STRUCTURE
============================================================

MEMBER 1 - FRONTEND + UI/UX

Responsibilities:
- Login page
- Registration page
- Dashboard
- File upload interface
- File list
- File details
- Share dialog
- Shared-file page
- Download interface
- Profile page
- Security logs UI
- Admin dashboard UI
- Responsive design
- Loading states
- Toast notifications
- Error handling
- Final UI polish


MEMBER 2 - BACKEND + AUTHENTICATION

Responsibilities:
- Express server
- REST API
- User registration
- Login
- JWT authentication
- Refresh tokens
- Password hashing
- Authentication middleware
- Authorization middleware
- API validation
- Rate limiting
- Security headers
- File upload/download APIs
- Share APIs


MEMBER 3 - ENCRYPTION + FILE SECURITY

Responsibilities:
- AES-256-GCM file encryption
- File decryption
- SHA-256 hashing
- Integrity verification
- Secure random share tokens
- Password-protected sharing
- Expiration mechanism
- Download limits
- Secure file deletion
- Encryption key management
- Security-related testing


MEMBER 4 - DATABASE + DEVOPS + SECURITY TESTING

Responsibilities:
- Database schema
- User/file/share models
- Access logs
- Docker setup
- Environment configuration
- Deployment
- Database backup strategy
- API testing
- Security testing
- Penetration testing
- Documentation
- Final integration


============================================================
3. PROJECT STRUCTURE
============================================================

secure-file-sharing/
|
|-- frontend/
|
|-- backend/
|
|-- docs/
|
|-- docker/
|
|-- .env.example
|
|-- README.md
|
|-- docker-compose.yml
|
`-- .gitignore


Git Branches:

main
develop
feature/frontend
feature/backend
feature/security
feature/database


============================================================
4. WEEK 1 - PROTOTYPE
============================================================

WEEK 1 GOAL:

Build a working prototype.

At the end of Week 1, the team should be able to:

Register
  ->
Login
  ->
Open Dashboard
  ->
Upload File
  ->
View File
  ->
Generate Share Link
  ->
Open Share Link
  ->
Download File


DAY 1 - PROJECT SETUP

ALL MEMBERS:

Tasks:
- Finalize technology stack
- Create GitHub repository
- Create project structure
- Configure frontend
- Configure backend
- Configure database
- Create .env.example
- Decide API structure
- Decide database structure
- Setup Git branches

Deliverable:
- Project runs locally
- Frontend and backend communicate
- Database connection works


DAY 2 - AUTHENTICATION

MEMBER 2:
- Registration API
- Login API
- Password hashing
- JWT generation
- Authentication middleware

MEMBER 1:
- Login page
- Registration page

MEMBER 4:
- Users database/table
- Database connection testing

MEMBER 3:
- Review authentication security
- Help define secure token handling

Deliverable:
- User can register and login


DAY 3 - FILE DATABASE + UPLOAD

MEMBER 4:
Create file model/table:

files:
- id
- owner_id
- original_name
- stored_name
- file_size
- mime_type
- file_hash
- created_at

MEMBER 2:
- Upload API
- File validation basics

MEMBER 3:
- SHA-256 file hashing

MEMBER 1:
- Upload UI
- File list UI

Deliverable:
- User can upload a file
- File metadata is stored
- SHA-256 hash is generated


DAY 4 - FILE DOWNLOAD

MEMBER 2:
- Download API
- Authentication check

MEMBER 3:
- Basic integrity verification

MEMBER 1:
- Download button
- File details

MEMBER 4:
- Download testing
- Database verification

Deliverable:
- User can securely download their own files


DAY 5 - BASIC FILE SHARING

MEMBER 2:
- Share API

MEMBER 3:
- Secure random share token generation

MEMBER 4:
Create shares table:

shares:
- id
- file_id
- token
- created_at
- expires_at
- max_downloads
- download_count

MEMBER 1:
- Share dialog
- Share link page

Deliverable:
- User can generate a share link
- Another user can open the link
- File can be downloaded


DAY 6 - INTEGRATION

ALL MEMBERS:

Test complete flow:

Register
  ->
Login
  ->
Upload
  ->
View files
  ->
Generate share link
  ->
Open share link
  ->
Download

Tasks:
- Merge branches
- Fix API issues
- Fix UI issues
- Fix database issues
- Test different users


DAY 7 - WEEK 1 DEMO

WEEK 1 DELIVERABLE:

Working Prototype

Must include:
- Registration
- Login
- Dashboard
- File upload
- File list
- File download
- Basic file sharing
- Basic SHA-256 hashing

Do NOT spend too much time on advanced UI or advanced security
during Week 1.


============================================================
5. WEEK 2 - SECURITY IMPLEMENTATION
============================================================

WEEK 2 GOAL:

Convert the prototype into a secure file-sharing platform.

Main features:
- Encryption
- Integrity verification
- Access control
- Expiration
- Password-protected sharing
- Download limits
- Revocation
- Access logs


DAY 8 - AES-256-GCM ENCRYPTION

MEMBER 3:

Implement:

Original File
    ->
AES-256-GCM Encryption
    ->
Encrypted File
    ->
Storage

Encryption data should include:
- IV/nonce
- Authentication tag
- Encrypted file data
- Secure key reference

Important:
Encryption keys must not be stored insecurely beside the files.


DAY 9 - SHA-256 INTEGRITY VERIFICATION

MEMBER 3:
- Calculate SHA-256 during upload
- Store hash in database
- Verify hash during download

Flow:

Encrypted File
    ->
Decrypt
    ->
Calculate SHA-256
    ->
Compare Stored Hash
    ->
MATCH = Allow Download
MISMATCH = Reject


DAY 10 - ACCESS CONTROL

MEMBER 2:
Implement authorization.

Owner:
- Upload
- Download
- Share
- Delete
- Revoke

Recipient:
- Download shared file

Unauthorized User:
- Access denied

Test:
User A must not be able to directly access User B's private files.


DAY 11 - EXPIRATION

MEMBER 3 + MEMBER 2:

Allow share-link expiration:

- 1 hour
- 6 hours
- 24 hours
- 7 days
- Custom expiration

Expired links should return:

403 Forbidden
Share link expired


DAY 12 - PASSWORD-PROTECTED SHARING

MEMBER 3:
- Add optional password protection
- Hash share passwords
- Verify password before allowing download

Flow:

Share Link
    +
Password
    ->
Verification
    ->
Download


DAY 13 - DOWNLOAD LIMITS + REVOCATION

Implement:

Maximum downloads:
- 1
- 5
- 10
- Unlimited

Add:
- Revoke share link
- Disable revoked links
- Update download count

After revocation:

403 Forbidden
This share link has been revoked.


DAY 14 - ACCESS LOGGING

MEMBER 4:

Track:
- User
- File
- Action
- Timestamp
- IP address where appropriate
- Result

Example:

FILE DOWNLOADED
File: report.pdf
User: User123
Time: 14:32
Result: SUCCESS

Also log:
- Failed login
- Failed share password
- Unauthorized access
- Expired link access
- Revoked link access


============================================================
6. WEEK 3 - FINALIZATION + DEPLOYMENT
============================================================

WEEK 3 GOAL:

Create a polished, tested, secure, and deployable final product.


DAY 15 - SECURITY HARDENING

MEMBER 2 + MEMBER 4:

Implement:
- Helmet
- CORS configuration
- Rate limiting
- Input validation
- File-size limits
- File-type validation
- Secure authentication handling
- Secure error handling

Protect against:
- Brute force
- Path traversal
- Unauthorized downloads
- Malicious filenames
- Oversized uploads
- Token guessing
- IDOR
- Information disclosure


DAY 16 - SECURE FILE HANDLING

MEMBER 3 + MEMBER 4:

Test and implement:
- Filename sanitization
- File size restrictions
- File type validation
- Safe storage paths
- Secure deletion
- Encryption verification

Example malicious filename:

../../secret.txt

The system must reject or safely sanitize it.


DAY 17 - FRONTEND FINALIZATION

MEMBER 1:

Complete:
- Landing page
- Login
- Registration
- Dashboard
- Upload
- Files
- File details
- Share
- Shared file page
- Profile
- Security logs
- Settings

Add:
- Responsive design
- Loading states
- Toast notifications
- Error messages
- Empty states
- Dark mode if desired
- Final visual polish


DAY 18 - ADMIN DASHBOARD

MEMBER 4 + MEMBER 1:

Admin dashboard should show:

- Total users
- Total files
- Total storage
- Active shares
- Expired shares
- Total downloads
- Security events

Security events:
- Failed login
- Unauthorized access
- Expired link usage
- Revoked link usage
- Failed share-password attempts


DAY 19 - SECURITY TESTING

ALL MEMBERS:

Authentication Testing:
- Invalid password
- Brute-force attempts
- Expired token
- Invalid JWT
- Logout/session testing

Authorization Testing:
- User A attempts User B's file
- User A attempts User B's share
- Direct API access
- IDOR testing

File Testing:
- Huge file
- Invalid extension
- Malicious filename
- Empty file
- Duplicate filename
- Unsupported file type

Sharing Testing:
- Expired link
- Revoked link
- Wrong password
- Download limit
- Invalid token
- Random token


DAY 20 - PENETRATION TESTING

Recommended tools:
- Burp Suite
- OWASP ZAP
- Nmap
- curl
- Postman or Insomnia

Test for:
- IDOR
- Broken access control
- Authentication flaws
- Rate-limit bypass
- Path traversal
- Injection
- Information disclosure
- Weak share tokens
- Improper error handling


DAY 21 - FINAL INTEGRATION + DEPLOYMENT

ALL MEMBERS:

Tasks:
- Merge all branches
- Fix remaining bugs
- Run complete test suite
- Security review
- Database backup
- Configure production environment
- Deploy frontend
- Deploy backend
- Configure database
- Configure HTTPS
- Test production
- Complete README
- Complete project documentation
- Prepare final presentation/demo


============================================================
7. FINAL FEATURE LIST
============================================================

AUTHENTICATION:
- Registration
- Login
- Logout
- JWT authentication
- Password hashing

FILE MANAGEMENT:
- Upload files
- Download files
- Delete files
- File metadata
- File hash

ENCRYPTION:
- AES-256-GCM encryption
- Secure decryption
- Secure key management

INTEGRITY:
- SHA-256 hash
- Hash verification
- Reject corrupted/modified files

SHARING:
- Secure random share links
- Password-protected links
- Expiration
- Download limits
- Revocation

ACCESS CONTROL:
- Owner permissions
- Recipient permissions
- Unauthorized access prevention
- IDOR protection

MONITORING:
- Access logs
- Download logs
- Failed login logs
- Security events

SECURITY:
- Rate limiting
- Helmet
- CORS
- Input validation
- File validation
- Path traversal protection
- Secure error handling

ADMIN:
- User statistics
- File statistics
- Download statistics
- Security event dashboard


============================================================
8. FINAL SECURITY ARCHITECTURE
============================================================

UPLOAD FLOW:

User
  ->
Authentication
  ->
Authorization
  ->
File Validation
  ->
SHA-256 Hash
  ->
AES-256-GCM Encryption
  ->
Encrypted Storage
  ->
Database Metadata


DOWNLOAD FLOW:

User
  ->
Authentication
  ->
Authorization
  ->
Share Validation
  ->
Expiration Check
  ->
Password Check
  ->
Download Limit Check
  ->
Encrypted File
  ->
Decrypt
  ->
SHA-256 Verification
  ->
Access Log
  ->
Download


SHARING FLOW:

Owner
  ->
Select File
  ->
Set Password (Optional)
  ->
Set Expiration
  ->
Set Download Limit
  ->
Generate Secure Random Token
  ->
Create Share Link
  ->
Share Link


REVOKE FLOW:

Owner
  ->
Select Share
  ->
Revoke
  ->
Share Disabled
  ->
Future Access
  ->
403 Forbidden


============================================================
9. SECURITY MECHANISM AND PURPOSE
============================================================

JWT:
Purpose - Authentication

bcrypt/Argon2:
Purpose - Password protection

AES-256-GCM:
Purpose - File confidentiality

SHA-256:
Purpose - File integrity verification

Secure Random Tokens:
Purpose - Prevent share-link guessing

Expiration:
Purpose - Time-based access control

Download Limits:
Purpose - Usage control

RBAC/Authorization:
Purpose - Access control

Rate Limiting:
Purpose - Brute-force protection

Helmet:
Purpose - HTTP security headers

CORS:
Purpose - Origin control

Input Validation:
Purpose - Malicious input protection

Audit Logs:
Purpose - Monitoring and accountability


============================================================
10. FINAL DEMONSTRATION FLOW
============================================================

For the final presentation, demonstrate the following:

1. Register User A
2. Login
3. Upload secret.pdf
4. Calculate SHA-256
5. Encrypt the file using AES-256-GCM
6. Show that the stored file is encrypted
7. Generate a share link
8. Add a share password
9. Set expiration
10. Set download limit
11. Open the link as User B
12. Enter the password
13. Perform authorization check
14. Decrypt the file
15. Verify SHA-256
16. Download the file
17. Show the access log
18. Revoke the link
19. Try the link again
20. Demonstrate ACCESS DENIED


============================================================
11. OPTIONAL FEATURES
============================================================

Only add these after all core features are working.

Level 1:
- Multiple file upload
- Drag and drop
- File preview
- Folder support
- QR-code sharing

Level 2:
- Email notifications
- Download notifications
- Share history
- Storage quotas
- User groups

Level 3:
- Client-side encryption
- End-to-end encryption
- Key rotation
- Malware scanning
- Suspicious download detection
- Device/session management
- Advanced security dashboard


============================================================
12. FINAL 3-WEEK MILESTONES
============================================================

WEEK 1:
WORKING PROTOTYPE

- Authentication
- Dashboard
- Upload
- Download
- Basic sharing
- Basic SHA-256 hashing


WEEK 2:
SECURE PROTOTYPE

- AES-256-GCM encryption
- SHA-256 verification
- Access control
- Expiration
- Password-protected sharing
- Download limits
- Revocation
- Access logs


WEEK 3:
FINAL PRODUCT

- Security hardening
- Admin dashboard
- Complete testing
- Penetration testing
- UI polish
- Deployment
- Documentation
- Final presentation


============================================================
13. TEAM WORKFLOW
============================================================

Daily 15-minute meeting:

1. What did I finish yesterday?
2. What will I work on today?
3. What blockers do I have?

Rules:
- Push code regularly
- Use feature branches
- Review code before merging
- Do not directly push experimental code to main
- Test before merging
- Keep API documentation updated
- Keep security decisions documented
- Every member should understand the complete project


============================================================
FINAL PROJECT TARGET
============================================================

By the end of 3 weeks, the platform should demonstrate:

CONFIDENTIALITY
    -> AES-256-GCM encryption

INTEGRITY
    -> SHA-256 verification

AUTHENTICATION
    -> JWT + secure password hashing

AUTHORIZATION
    -> User/file permissions

ACCESS CONTROL
    -> Password + expiration + download limits

ACCOUNTABILITY
    -> Access and security logs

SECURITY
    -> Rate limiting + validation + security testing

DEPLOYMENT
    -> Fully working production setup


END OF PROJECT PLAN
