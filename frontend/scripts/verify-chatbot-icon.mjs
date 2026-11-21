import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHATBOT_PATH = path.resolve(__dirname, '../src/components/AiChatbot.jsx');
const ASSETS_ORIGINAL = path.resolve(__dirname, '../src/assets/chatbot-robot.png');
const ASSETS_CIRCLE = path.resolve(__dirname, '../src/assets/chatbot-robot-circle.png');
const PUBLIC_ORIGINAL = path.resolve(__dirname, '../public/chatbot-robot.png');
const PUBLIC_CIRCLE = path.resolve(__dirname, '../public/chatbot-robot-circle.png');

const chatbotSrc = fs.readFileSync(CHATBOT_PATH, 'utf-8');

const results = [];

function test(id, description, condition, details = '') {
  const status = condition ? 'PASS' : 'FAIL';
  results.push({ id, description, status, details });
  console.log(`[${status === 'PASS' ? '✓ PASS' : '✕ FAIL'}] ${id}: ${description} ${details ? '— ' + details : ''}`);
}

console.log('='.repeat(75));
console.log('INTERVEXA AI — CUSTOM ROBOT CHATBOT LAUNCHER VERIFICATION');
console.log('='.repeat(75));

// 1. Assets exist in assets and public folders
test('ICON-01', 'Original robot image stored in src/assets and public', fs.existsSync(ASSETS_ORIGINAL) && fs.existsSync(PUBLIC_ORIGINAL));
test('ICON-02', 'High-res circular robot image stored in src/assets and public', fs.existsSync(ASSETS_CIRCLE) && fs.existsSync(PUBLIC_CIRCLE));

// 2. AiChatbot.jsx imports robot image
const importsRobot = chatbotSrc.includes('import robotAvatar from "../assets/chatbot-robot-circle.png";');
test('ICON-03', 'AiChatbot.jsx imports custom robot image asset', importsRobot);

// 3. Launcher uses custom robot image instead of generic IconBot
const launcherHasRobotImg = chatbotSrc.includes('className="launcher-robot-img"') && chatbotSrc.includes('src={robotAvatar}');
const launcherNoIconBot = !chatbotSrc.match(/className="launcher-icon-wrap"[\s\S]*?<IconBot/);
test('ICON-04', 'Launcher button uses custom robot image (no generic IconBot)', launcherHasRobotImg && launcherNoIconBot);

// 4. Circular launcher has clean white/light-purple background and subtle purple shadow
const launcherStylingMatches = chatbotSrc.includes('background: #FFFFFF;') &&
  chatbotSrc.includes('border: 2px solid rgba(139, 92, 246, 0.3);') &&
  chatbotSrc.includes('box-shadow: 0 8px 24px rgba(124, 58, 237, 0.28)');
test('ICON-05', 'Launcher has white circular background with subtle purple shadow', launcherStylingMatches);

// 5. Tooltip text: "Ask Intervexa AI"
const hasTooltip = chatbotSrc.includes('<span className="launcher-tooltip">Ask Intervexa AI</span>');
test('ICON-06', 'Floating launcher displays tooltip "Ask Intervexa AI"', hasTooltip);

// 6. Header and message avatar branding consistency
const headerHasRobot = chatbotSrc.includes('className="header-avatar-img"') && chatbotSrc.includes('src={robotAvatar}');
const msgAvatarHasRobot = chatbotSrc.includes('className="msg-avatar-img"') && chatbotSrc.includes('src={robotAvatar}');
test('ICON-07', 'Header and AI message responses use the custom robot identity', headerHasRobot && msgAvatarHasRobot);

// 7. Responsive styling for mobile
const mobileResponsiveMatches = chatbotSrc.includes('@media (max-width: 480px)') &&
  chatbotSrc.includes('.ai-chatbot-launcher') &&
  chatbotSrc.includes('width: 52px;');
test('ICON-08', 'Mobile responsive style adjusts launcher size for smaller screens', mobileResponsiveMatches);

console.log('='.repeat(75));
const total = results.length;
const passed = results.filter(r => r.status === 'PASS').length;
console.log(`TOTAL: ${passed} of ${total} custom robot icon tests PASSED.`);
console.log('='.repeat(75));

if (passed !== total) {
  process.exit(1);
} else {
  process.exit(0);
}

