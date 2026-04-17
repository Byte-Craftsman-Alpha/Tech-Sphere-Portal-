import { parse } from 'url';
import adminApproveUser from '../api_handlers/admin-approve-user.js';
import adminContent from '../api_handlers/admin-content.js';
import adminCertificates from '../api_handlers/admin-certificates.js';
import adminCreateUser from '../api_handlers/admin-create-user.js';
import adminResetPassword from '../api_handlers/admin-reset-password.js';
import adminSendUserDetails from '../api_handlers/admin-send-user-details.js';
import adminUpdateProfile from '../api_handlers/admin-update-profile.js';
import certificateVerify from '../api_handlers/certificate-verify.js';
import changePasswordWithOtp from '../api_handlers/change-password-with-otp.js';
import cleanupUnapproved from '../api_handlers/cleanup-unapproved.js';
import deleteUser from '../api_handlers/delete-user.js';
import content from '../api_handlers/content.js';
import profile from '../api_handlers/profile.js';
import publicRegistrations from '../api_handlers/public-registrations.js';
import registrationShare from '../api_handlers/registration-share.js';
import repairOrphans from '../api_handlers/repair-orphans.js';
import sendOtp from '../api_handlers/send-otp.js';
import sendPasswordOtp from '../api_handlers/send-password-otp.js';
import verifyOtp from '../api_handlers/verify-otp.js';

const routes = {
  '/admin-approve-user': adminApproveUser,
  '/admin-content': adminContent,
  '/admin-certificates': adminCertificates,
  '/admin-create-user': adminCreateUser,
  '/admin-reset-password': adminResetPassword,
  '/admin-send-user-details': adminSendUserDetails,
  '/admin-update-profile': adminUpdateProfile,
  '/certificate-verify': certificateVerify,
  '/change-password-with-otp': changePasswordWithOtp,
  '/cleanup-unapproved': cleanupUnapproved,
  '/delete-user': deleteUser,
  '/content': content,
  '/profile': profile,
  '/public-registrations': publicRegistrations,
  '/registration-share': registrationShare,
  '/repair-orphans': repairOrphans,
  '/send-otp': sendOtp,
  '/send-password-otp': sendPasswordOtp,
  '/verify-otp': verifyOtp
};

export default async function handler(req, res) {
  const parsedUrl = parse(req.url, true);
  let pathname = parsedUrl.pathname || '/';
  if (pathname.startsWith('/api')) pathname = pathname.replace(/^\/api/, '');
  if (pathname === '') pathname = '/';

  const routeHandler = routes[pathname];
  if (!routeHandler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: `Route ${pathname} not found` }));
    return;
  }

  // Ensure query is available for handlers expecting it
  req.query = parsedUrl.query || {};
  await routeHandler(req, res);
}
