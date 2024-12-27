import {
  createHeading,
  createParagraph,
  createCard,
  createBlock,
  createFlexContainer,
  createFlexItem,
  createButton,
  createImage,
  createList,
  createTable,
  createForm,
  createInput,
  createLabel,
  createDivider,
  createBadge,
  createAlert
} from './components.js';
import {
  sendMailByAPI
} from '../communication/email/nodemailer.js'

function createTechConferenceEmail() {
  const emailContent = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
      ${createHeading({ text: "TechCon 2024", level: 1, customStyles: { color: "#4a4a4a" } })}
      ${createAlert({ message: "Early bird registration ends in 3 days!", type: "warning" })}
      ${createParagraph({ text: "Join us for the biggest tech event of the year!", fontSize: 18 })}
      ${createImage({ src: "https://example.com/techcon-banner.jpg", alt: "TechCon 2024 Banner" })}
      ${createCard({ content: `
        ${createHeading({ text: "Event Details", level: 3 })}
        ${createList({ items: [
          "Date: September 15-17, 2024",
          "Location: Tech City Convention Center",
          "Keynote Speaker: Jane Innovator, CEO of FutureTech"
        ] })}
      ` })}
      ${createHeading({ text: "Featured Tracks", level: 2 })}
      ${createFlexContainer({ content: `
        ${createFlexItem({ content: createCard({ content: `
          ${createHeading({ text: "AI & Machine Learning", level: 4 })}
          ${createParagraph({ text: "Explore the latest in AI and ML technologies." })}
          ${createBadge({ text: "Hot Topic" })}
        ` }), flexBasis: "30%" })}
        ${createFlexItem({ content: createCard({ content: `
          ${createHeading({ text: "Blockchain & Crypto", level: 4 })}
          ${createParagraph({ text: "Dive into the world of decentralized technologies." })}
          ${createBadge({ text: "Trending" })}
        ` }), flexBasis: "30%" })}
        ${createFlexItem({ content: createCard({ content: `
          ${createHeading({ text: "IoT & Edge Computing", level: 4 })}
          ${createParagraph({ text: "Discover the future of connected devices." })}
          ${createBadge({ text: "Innovative" })}
        ` }), flexBasis: "30%" })}
      ` })}
      ${createDivider({})}
      ${createHeading({ text: "Ticket Options", level: 2 })}
      ${createTable({ data: [
        ["Type", "Price", "Perks"],
        ["Standard", "$499", "All sessions, Swag bag"],
        ["VIP", "$799", "All sessions, Swag bag, VIP lounge, Dinner with speakers"],
        ["Student", "$199", "All sessions, Swag bag (with student ID)"]
      ] })}
      ${createButton({ text: "Register Now", href: "https://example.com/register", customStyles: { backgroundColor: "#4CAF50" } })}
      ${createDivider({})}
      ${createHeading({ text: "Stay Updated", level: 2 })}
      ${createBlock({ content: `
        ${createForm({ content: `
          ${createLabel({ text: "Email", forAttribute: "email" })}
          ${createInput({ type: "email", name: "email", placeholder: "Enter your email" })}
          ${createButton({ text: "Subscribe", href: "#", customStyles: { backgroundColor: "#008CBA" } })}
        `, action: "#", method: "post", customStyles: { backgroundColor: "#f0f0f0", padding: "20px" } })}
      ` })}
      ${createDivider({})}
      ${createParagraph({ text: "We can't wait to see you at TechCon 2024!", fontSize: 16, color: "#666" })}
    </div>
  `;
  return emailContent;
}

// Usage
const emailHTML = createTechConferenceEmail();
const emailObject = {
  to: ["reconozco@gmail.com"],
  subject: "Tech Conference",
  html: emailHTML
}
sendMailByAPI(emailObject);