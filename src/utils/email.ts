import sgMail from "@sendgrid/mail";
import { env } from "../config/env";

// SendGrid 초기화
sgMail.setApiKey(env.SENDGRID_API_KEY);

/**
 * 6자리 랜덤 숫자 인증 코드 생성
 * @returns 6자리 숫자 문자열 (000000-999999)
 */
export function generateVerificationCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

/**
 * 인증 코드 이메일 발송
 * @param to 수신자 이메일 주소
 * @param code 인증 코드 (6자리 숫자)
 * @returns Promise<void>
 */
export async function sendVerificationEmail(
  to: string,
  code: string
): Promise<void> {
  // 에메랄드 그린 색상 (프로젝트 accent 색상 기반)
  const primaryColor = "#10b981"; // emerald-500
  const primaryColorDark = "#059669"; // emerald-600
  const primaryColorLight = "#d1fae5"; // emerald-100
  const textColor = "#1f2937"; // gray-800
  const textColorSecondary = "#6b7280"; // gray-500
  const textColorLight = "#9ca3af"; // gray-400
  const borderColor = "#e5e7eb"; // gray-200
  const bgColor = "#ffffff";
  const bgColorSecondary = "#f9fafb"; // gray-50

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ko">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>이메일 인증</title>
        <!--[if mso]>
        <style type="text/css">
          table {border-collapse:collapse;border-spacing:0;margin:0;}
          div, td {padding:0;}
          div {margin:0 !important;}
        </style>
        <![endif]-->
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; line-height: 1.6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <!-- Main Container -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background-color: ${bgColor}; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden;">

                <!-- Header with Gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColorDark} 100%); padding: 32px 40px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">
                      이메일 인증
                    </h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <!-- Greeting -->
                    <p style="margin: 0 0 16px 0; color: ${textColor}; font-size: 16px; font-weight: 500;">
                      안녕하세요,
                    </p>
                    <p style="margin: 0 0 32px 0; color: ${textColor}; font-size: 15px; line-height: 1.7;">
                      아래 인증 코드를 입력하여 이메일 인증을 완료해주세요.
                    </p>

                    <!-- Verification Code Box -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="padding: 0 0 32px 0;">
                          <div style="background: linear-gradient(135deg, ${primaryColorLight} 0%, #ecfdf5 100%); border: 2px solid ${primaryColor}; border-radius: 12px; padding: 32px 24px; text-align: center; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15);">
                            <p style="margin: 0 0 8px 0; color: ${textColorSecondary}; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">
                              인증 코드
                            </p>
                            <h2 style="margin: 0; color: ${primaryColorDark}; font-size: 40px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace; text-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);">
                              ${code}
                            </h2>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Info Section -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="background-color: ${bgColorSecondary}; border-left: 4px solid ${primaryColor}; border-radius: 6px; padding: 16px 20px;">
                          <p style="margin: 0; color: ${textColorSecondary}; font-size: 14px; line-height: 1.6;">
                            <strong style="color: ${textColor};"> 이 코드는 </strong><strong style="color: ${primaryColorDark};">${
    env.SENDGRID_EXPIRES_IN
  }분간</strong><strong style="color: ${textColor};"> 유효합니다.</strong><br>
                            <strong style="color: ${textColor};">이 요청을 하지 않으셨다면 이 이메일을 무시하셔도 됩니다.</strong>
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 32px 0 0 0;">
                          <hr style="border: none; border-top: 1px solid ${borderColor}; margin: 0;">
                        </td>
                      </tr>
                    </table>

                    <!-- Footer -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 24px 0 0 0; text-align: center;">
                          <p style="margin: 0; color: ${textColorLight}; font-size: 12px; line-height: 1.5;">
                            이 이메일은 자동으로 발송되었습니다.<br>
                            문의사항이 있으시면 고객센터로 연락해주세요.
                          </p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- Bottom Accent -->
                <tr>
                  <td style="height: 4px; background: linear-gradient(90deg, ${primaryColor} 0%, ${primaryColorDark} 100%);"></td>
                </tr>

              </table>

              <!-- Spacer -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
                <tr>
                  <td style="padding: 20px 0 0 0; text-align: center;">
                    <p style="margin: 0; color: ${textColorLight}; font-size: 11px;">
                      © ${new Date().getFullYear()} AI Trader. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const textContent = `
이메일 인증

안녕하세요,

아래 인증 코드를 입력하여 이메일 인증을 완료해주세요.

인증 코드: ${code}

이 코드는 ${env.SENDGRID_EXPIRES_IN}분간 유효합니다.
이 요청을 하지 않으셨다면 이 이메일을 무시하셔도 됩니다.

이 이메일은 자동으로 발송되었습니다.
문의사항이 있으시면 고객센터로 연락해주세요.

© ${new Date().getFullYear()} AI Trader. All rights reserved.
  `;

  const msg = {
    to,
    from: {
      email: env.SENDGRID_FROM_EMAIL, //발신자 이메일
      name: env.SENDGRID_FROM_NAME, //발신자 이름
    },
    subject: "AI Trader 회원 이메일 인증 요청",
    text: textContent,
    html: htmlContent,
  };

  await sgMail.send(msg);
}
