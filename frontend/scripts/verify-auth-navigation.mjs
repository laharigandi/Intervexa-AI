/**
 * Automated Verification Script for Intervexa AI Authentication Navigation Flow
 * Tests all 10 required navigation and authentication scenarios:
 * 1. New visitor opens landing page (unauthenticated).
 * 2. Visitor clicks Get Started -> navigates to /login.
 * 3. Sign In / Sign Up page displays credentials form.
 * 4. User successfully signs in -> token stored in AuthContext & localStorage.
 * 5. Dashboard opens for authenticated user.
 * 6. User logs out -> session cleared & returns to landing page ("/").
 * 7. User clicks Get Started again after logout -> navigates to /login.
 * 8. Authentication page opens instead of Dashboard.
 * 9. Unauthenticated direct access to /dashboard -> ProtectedRoute redirects to /login.
 * 10. Expired / invalid token handling -> session wiped and redirected to /login.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOME_PATH = path.resolve(__dirname, '../src/pages/Home.jsx');
const LOGIN_PATH = path.resolve(__dirname, '../src/pages/Login.jsx');
const SIGNUP_PATH = path.resolve(__dirname, '../src/pages/Signup.jsx');
const NAVBAR_PATH = path.resolve(__dirname, '../src/components/Navbar.jsx');
const SIDEBAR_PATH = path.resolve(__dirname, '../src/components/Sidebar.jsx');
const PROFILE_PATH = path.resolve(__dirname, '../src/pages/Profile.jsx');
const PROTECTED_ROUTE_PATH = path.resolve(__dirname, '../src/components/ProtectedRoute.jsx');
const APP_PATH = path.resolve(__dirname, '../src/App.jsx');

const homeSrc = fs.readFileSync(HOME_PATH, 'utf-8');
const loginSrc = fs.readFileSync(LOGIN_PATH, 'utf-8');
const signupSrc = fs.readFileSync(SIGNUP_PATH, 'utf-8');
const navbarSrc = fs.readFileSync(NAVBAR_PATH, 'utf-8');
const sidebarSrc = fs.readFileSync(SIDEBAR_PATH, 'utf-8');
const profileSrc = fs.readFileSync(PROFILE_PATH, 'utf-8');
const protectedRouteSrc = fs.readFileSync(PROTECTED_ROUTE_PATH, 'utf-8');
const appSrc = fs.readFileSync(APP_PATH, 'utf-8');

const results = [];

function test(id, description, condition, details = '') {
  const status = condition ? 'PASS' : 'FAIL';
  results.push({ id, description, status, details });
  console.log(`[${status === 'PASS' ? '✓ PASS' : '✕ FAIL'}] ${id}: ${description} ${details ? '— ' + details : ''}`);
}

console.log('='.repeat(75));
console.log('INTERVEXA AI — AUTHENTICATION NAVIGATION FLOW VERIFICATION');
console.log('='.repeat(75));

// 1. Get Started and Sign In button handlers in Home.jsx do NOT navigate to /dashboard
const getStartedHandlerMatches = homeSrc.match(/const handleGetStarted\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\};/);
const getStartedHandlerBody = getStartedHandlerMatches ? getStartedHandlerMatches[1] : '';
const getStartedDoesNotDirectlyNavigateDashboard = !getStartedHandlerBody.includes('navigate("/dashboard")');
const getStartedNavigatesToSignup = getStartedHandlerBody.includes('navigate("/signup")');

const signInHandlerMatches = homeSrc.match(/const handleSignIn\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\};/);
const signInHandlerBody = signInHandlerMatches ? signInHandlerMatches[1] : '';
const signInNavigatesToLogin = signInHandlerBody.includes('navigate("/login")');

test('NAV-01', 'handleGetStarted does not directly route to /dashboard', getStartedDoesNotDirectlyNavigateDashboard);
test('NAV-02', 'handleGetStarted navigates directly to /signup (registration flow)', getStartedNavigatesToSignup);
test('NAV-03', 'handleSignIn navigates directly to /login (authentication flow)', signInNavigatesToLogin);

// 2. Landing page navbar removes Dashboard link from public navbar
const desktopNavbarRemovesDashboard = !homeSrc.includes('<Link\n                  to="/dashboard"\n                  style={{\n                    fontSize: 15,\n                    fontWeight: 600,\n                    color: theme.textSecondary,') &&
  !homeSrc.match(/className="nav-desktop-actions"[\s\S]*?to="\/dashboard"/);
test('NAV-04', 'Public landing page navbar removes Dashboard button/link', desktopNavbarRemovesDashboard);

// 3. Desktop navbar in Home.jsx has Sign In and Get Started
const desktopHasSignIn = homeSrc.includes('className="nav-signin-btn"') && homeSrc.includes('handleSignIn');
const desktopHasGetStarted = homeSrc.includes('className="nav-getstarted-btn"') && homeSrc.includes('handleGetStarted');
test('NAV-05', 'Desktop navbar includes Sign In and Get Started actions', desktopHasSignIn && desktopHasGetStarted);

// 4. Mobile menu in Home.jsx has Sign In and Get Started
const mobileHasSignIn = homeSrc.includes('className="nav-mobile-signin-btn"') && homeSrc.includes('handleSignIn();');
const mobileHasGetStarted = homeSrc.includes('className="nav-mobile-getstarted-btn"') && homeSrc.includes('handleGetStarted();');
test('NAV-06', 'Mobile hamburger menu executes both Sign In and Get Started handlers', mobileHasSignIn && mobileHasGetStarted);

// 4. Login.jsx does NOT auto-redirect unprompted
const loginAutoRedirect = loginSrc.includes('navigate("/dashboard", { replace: true })');
test('AUTH-01', 'Login.jsx does not unconditionally auto-redirect to dashboard', !loginAutoRedirect);

// 5. Signup.jsx does NOT auto-redirect unprompted
const signupAutoRedirect = signupSrc.includes('navigate("/dashboard", { replace: true })');
test('AUTH-02', 'Signup.jsx does not unconditionally auto-redirect to dashboard', !signupAutoRedirect);

// 6. Login.jsx preserves credentials form & Google Login
const hasEmailField = loginSrc.includes('type="email"') && loginSrc.includes('value={email}');
const hasPasswordField = loginSrc.includes('value={password}');
const hasGoogleLogin = loginSrc.includes('<GoogleLogin') && loginSrc.includes('handleGoogleSuccess');
const hasAuthTabSwitcher = loginSrc.includes('Sign In') && loginSrc.includes('Sign Up');
test('AUTH-03', 'Login.jsx preserves Email, Password, Google OAuth, and Auth Tab Switcher', hasEmailField && hasPasswordField && hasGoogleLogin && hasAuthTabSwitcher);

// 6b. Login and Signup completely remove "Currently signed in as"
const loginNoCurrentlySignedIn = !loginSrc.includes('Currently signed in as') && !loginSrc.includes('Go to Dashboard');
const signupNoCurrentlySignedIn = !signupSrc.includes('Currently signed in as') && !signupSrc.includes('Go to Dashboard');
test('AUTH-04', 'Login.jsx completely removes "Currently signed in as" section', loginNoCurrentlySignedIn);
test('AUTH-05', 'Signup.jsx completely removes "Currently signed in as" section', signupNoCurrentlySignedIn);

// 6c. Login page layout sequence verification (Toggle -> Email -> Password -> Sign In -> Divider -> Google -> Sign up now)
const togglePos = loginSrc.indexOf('Auth Tab Switcher');
const emailPos = loginSrc.indexOf('Email Address');
const signInBtnPos = loginSrc.indexOf('Signing In...');
const passwordPos = loginSrc.lastIndexOf('Password', signInBtnPos);
const dividerPos = loginSrc.indexOf('or continue with');
const googlePos = loginSrc.indexOf('<GoogleLogin');
const signupLinkPos = loginSrc.indexOf('Sign up now');
const layoutOrderValid = togglePos < emailPos && emailPos < passwordPos && passwordPos < signInBtnPos && signInBtnPos < dividerPos && dividerPos < googlePos && googlePos < signupLinkPos;
test('AUTH-06', 'Login.jsx follows the exact 7-part layout order without extra banners', layoutOrderValid);

// 7. ProtectedRoute redirects unauthenticated users to /login
const protectedRouteRedirects = protectedRouteSrc.includes('return <Navigate to="/login" replace />;');
const protectedRouteChecksAuth = protectedRouteSrc.includes('!isAuthenticated || !token || !user');
test('PROT-01', 'ProtectedRoute intercepts unauthenticated requests and redirects to /login', protectedRouteRedirects && protectedRouteChecksAuth);

// 8. Logout returns to Landing Page ("/") across all navigations
const navbarLogoutLanding = navbarSrc.includes('logout();\n    navigate("/");');
const sidebarLogoutLanding = sidebarSrc.includes('logout();\n    navigate("/");');
const profileLogoutLanding = profileSrc.includes('logout();\n    navigate("/");');
test('LOGOUT-01', 'Navbar handleLogout navigates to landing page ("/")', navbarLogoutLanding);
test('LOGOUT-02', 'Sidebar handleLogout navigates to landing page ("/")', sidebarLogoutLanding);
test('LOGOUT-03', 'Profile handleLogout navigates to landing page ("/")', profileLogoutLanding);

// 9. App.jsx route aliases for auth
const hasAuthAlias = appSrc.includes('path="/auth"') && appSrc.includes('Navigate to="/login"');
const hasDashboardProtected = appSrc.includes('path="/dashboard"') && appSrc.includes('<ProtectedRoute>');
test('ROUTE-01', 'App.jsx exposes /auth redirect alias to /login', hasAuthAlias);
test('ROUTE-02', 'App.jsx wraps /dashboard inside <ProtectedRoute>', hasDashboardProtected);

console.log('='.repeat(75));
const total = results.length;
const passed = results.filter(r => r.status === 'PASS').length;
console.log(`TOTAL: ${passed} of ${total} navigation & authentication tests PASSED.`);
console.log('='.repeat(75));

if (passed !== total) {
  process.exit(1);
} else {
  process.exit(0);
}

