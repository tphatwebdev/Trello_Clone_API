import { BrevoClient } from '@getbrevo/brevo'
import { env } from '~/config/environment'

const brevo = new BrevoClient({
  apiKey: env.BREVO_API_KEY,
  timeoutInSeconds: 30,
  maxRetries: 3
})

const sendEmail = async (recipientEmail, customSubject, customHtmlContent) => {
  await brevo.transactionalEmails.sendTransacEmail({
    subject: customSubject,
    htmlContent: customHtmlContent,
    sender: { name: env.ADMIN_EMAIL_NAME, email: env.ADMIN_EMAIL_ADDRESS },
    to: [{ email: recipientEmail }]
  })
}

export const BrevoProvider = {
  sendEmail
}