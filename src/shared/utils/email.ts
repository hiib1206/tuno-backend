import { Resend } from "resend";
import { env } from "../../config/env";

const resend = new Resend(env.RESEND_API_KEY);

/**
 * 6자리 랜덤 숫자 인증 코드를 생성한다.
 *
 * @returns 6자리 숫자 문자열 (000000-999999)
 */
export function generateVerificationCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

/**
 * 인증 코드 이메일을 발송한다.
 *
 * @param to - 수신자 이메일 주소
 * @param code - 인증 코드 (6자리 숫자)
 * @throws {@link Error} 이메일 발송 실패 시
 */
export async function sendVerificationEmail(
  to: string,
  code: string
): Promise<void> {
  const brand = "#00AE43";
  const textPrimary = "#111111";
  const textSecondary = "#888888";
  const bgPage = "#f7f7f7";
  const bgCard = "#ffffff";
  const bgCode = "#f9fafb";
  const borderCode = "#e5e5e5";
  const divider = "#f0f0f0";
  const expiresIn = Math.floor(env.EMAIL_CODE_EXPIRES_IN / 60);
  const year = new Date().getFullYear();

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
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${bgPage}; line-height: 1.5; -webkit-font-smoothing: antialiased;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${bgPage};">
          <tr>
            <td align="center" style="padding: 48px 20px;">

              <!-- Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; background-color: ${bgCard}; border-radius: 16px; overflow: hidden;">

                <!-- Brand Bar -->
                <tr>
                  <td style="height: 3px; background-color: ${brand};"></td>
                </tr>

                <!-- Logo -->
                <tr>
                  <td style="padding: 40px 40px 0 40px; text-align: center;">
                    <span style="font-size: 30px; font-weight: 700; color: ${brand}; letter-spacing: -0.5px;">Tuno</span>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 32px 40px 40px 40px;">

                    <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: ${textPrimary}; text-align: center; letter-spacing: -0.3px;">
                      이메일 인증
                    </h1>
                    <p style="margin: 0 0 32px 0; font-size: 14px; color: ${textSecondary}; text-align: center; line-height: 1.6;">
                      아래 코드를 입력하여 인증을 완료해주세요.
                    </p>

                    <!-- Code -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td align="center">
                          <div style="display: inline-block; padding: 20px 40px; background-color: ${bgCode}; border: 1px solid ${borderCode}; border-radius: 12px;">
                            <span style="font-size: 36px; font-weight: 700; letter-spacing: 10px; color: ${textPrimary}; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;">
                              ${code}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Timer -->
                    <p style="margin: 20px 0 0 0; font-size: 13px; color: ${textSecondary}; text-align: center;">
                      <span style="color: ${brand}; font-weight: 600;">${expiresIn}분</span> 후 만료됩니다
                    </p>

                    <!-- Divider -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 32px 0;">
                          <div style="height: 1px; background-color: ${divider};"></div>
                        </td>
                      </tr>
                    </table>

                    <!-- Notice -->
                    <p style="margin: 0; font-size: 13px; color: ${textSecondary}; text-align: center; line-height: 1.7;">
                      본인이 요청하지 않았다면 이 메일을 무시해주세요.<br>
                      코드를 타인과 공유하지 마세요.
                    </p>

                  </td>
                </tr>

              </table>

              <!-- Footer -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px;">
                <tr>
                  <td style="padding: 24px 0 0 0; text-align: center;">
                    <p style="margin: 0; font-size: 11px; color: ${textSecondary};">
                      &copy; ${year} Tuno. All rights reserved.
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

  const textContent = `이메일 인증

아래 코드를 입력하여 인증을 완료해주세요.

인증 코드: ${code}

${expiresIn}분 후 만료됩니다.
본인이 요청하지 않았다면 이 메일을 무시해주세요.
코드를 타인과 공유하지 마세요.

© ${year} Tuno. All rights reserved.
  `;

  const { error } = await resend.emails.send({
    from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
    to: [to],
    subject: "Tuno 회원 이메일 인증 요청",
    text: textContent,
    html: htmlContent,
  });

  if (error) {
    throw new Error(`이메일 발송 실패: ${error.message}`);
  }
}

/**
 * 아이디(username)를 마스킹 처리한다.
 *
 * @param username - 원본 아이디
 * @returns 마스킹된 아이디 (예: "username" -> "us****me")
 */
export function maskUsername(username: string): string {
  if (username.length <= 4) {
    return username[0] + "*".repeat(username.length - 1);
  }
  const visibleStart = username.slice(0, 2);
  const visibleEnd = username.slice(-2);
  const maskedLength = username.length - 4;
  return visibleStart + "*".repeat(maskedLength) + visibleEnd;
}

/**
 * 아이디 찾기 결과 이메일을 발송한다.
 *
 * @param to - 수신자 이메일 주소
 * @param maskedUsername - 마스킹된 아이디
 * @throws {@link Error} 이메일 발송 실패 시
 */
export async function sendFindUsernameEmail(
  to: string,
  maskedUsername: string
): Promise<void> {
  const brand = "#00AE43";
  const textPrimary = "#111111";
  const textSecondary = "#888888";
  const bgPage = "#f7f7f7";
  const bgCard = "#ffffff";
  const bgCode = "#f9fafb";
  const borderCode = "#e5e5e5";
  const divider = "#f0f0f0";
  const year = new Date().getFullYear();

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ko">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>아이디 찾기 안내</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${bgPage}; line-height: 1.5;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${bgPage};">
          <tr>
            <td align="center" style="padding: 48px 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; background-color: ${bgCard}; border-radius: 16px; overflow: hidden;">
                <tr><td style="height: 3px; background-color: ${brand};"></td></tr>
                <tr>
                  <td style="padding: 40px 40px 0 40px; text-align: center;">
                    <span style="font-size: 30px; font-weight: 700; color: ${brand};">Tuno</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 40px 40px 40px;">
                    <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: ${textPrimary}; text-align: center;">
                      아이디 찾기
                    </h1>
                    <p style="margin: 0 0 32px 0; font-size: 14px; color: ${textSecondary}; text-align: center;">
                      요청하신 아이디 정보입니다.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td align="center">
                          <div style="display: inline-block; padding: 20px 40px; background-color: ${bgCode}; border: 1px solid ${borderCode}; border-radius: 12px;">
                            <span style="font-size: 24px; font-weight: 700; color: ${textPrimary};">
                              ${maskedUsername}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 32px 0;">
                          <div style="height: 1px; background-color: ${divider};"></div>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0; font-size: 13px; color: ${textSecondary}; text-align: center; line-height: 1.7;">
                      본인이 요청하지 않았다면 이 메일을 무시해주세요.
                    </p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px;">
                <tr>
                  <td style="padding: 24px 0 0 0; text-align: center;">
                    <p style="margin: 0; font-size: 11px; color: ${textSecondary};">
                      &copy; ${year} Tuno. All rights reserved.
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

  const textContent = `아이디 찾기

요청하신 아이디 정보입니다.

아이디: ${maskedUsername}

본인이 요청하지 않았다면 이 메일을 무시해주세요.

© ${year} Tuno. All rights reserved.
  `;

  const { error } = await resend.emails.send({
    from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
    to: [to],
    subject: "Tuno 아이디 찾기 안내",
    text: textContent,
    html: htmlContent,
  });

  if (error) {
    throw new Error(`이메일 발송 실패: ${error.message}`);
  }
}

/**
 * 비밀번호 재설정 링크 이메일을 발송한다.
 *
 * @param to - 수신자 이메일 주소
 * @param resetToken - UUID 토큰
 * @throws {@link Error} 이메일 발송 실패 시
 */
export async function sendPasswordResetEmail(
  to: string,
  resetToken: string
): Promise<void> {
  const brand = "#00AE43";
  const textPrimary = "#111111";
  const textSecondary = "#888888";
  const bgPage = "#f7f7f7";
  const bgCard = "#ffffff";
  const divider = "#f0f0f0";
  const year = new Date().getFullYear();
  const expiresIn = 5; // 5분

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ko">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>비밀번호 재설정 안내</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${bgPage}; line-height: 1.5;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${bgPage};">
          <tr>
            <td align="center" style="padding: 48px 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; background-color: ${bgCard}; border-radius: 16px; overflow: hidden;">
                <tr><td style="height: 3px; background-color: ${brand};"></td></tr>
                <tr>
                  <td style="padding: 40px 40px 0 40px; text-align: center;">
                    <span style="font-size: 30px; font-weight: 700; color: ${brand};">Tuno</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 40px 40px 40px;">
                    <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: ${textPrimary}; text-align: center;">
                      비밀번호 재설정
                    </h1>
                    <p style="margin: 0 0 32px 0; font-size: 14px; color: ${textSecondary}; text-align: center;">
                      아래 버튼을 클릭하여 비밀번호를 재설정하세요.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td align="center">
                          <a href="${resetUrl}" style="display: inline-block; padding: 16px 48px; background-color: ${brand}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                            비밀번호 재설정
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 20px 0 0 0; font-size: 13px; color: ${textSecondary}; text-align: center;">
                      <span style="color: ${brand}; font-weight: 600;">${expiresIn}분</span> 후 만료됩니다
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 32px 0;">
                          <div style="height: 1px; background-color: ${divider};"></div>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0; font-size: 13px; color: ${textSecondary}; text-align: center; line-height: 1.7;">
                      본인이 요청하지 않았다면 이 메일을 무시해주세요.<br>
                      링크를 타인과 공유하지 마세요.
                    </p>
                    <p style="margin: 16px 0 0 0; font-size: 11px; color: ${textSecondary}; text-align: center; word-break: break-all;">
                      버튼이 작동하지 않으면 아래 링크를 복사하세요:<br>
                      ${resetUrl}
                    </p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px;">
                <tr>
                  <td style="padding: 24px 0 0 0; text-align: center;">
                    <p style="margin: 0; font-size: 11px; color: ${textSecondary};">
                      &copy; ${year} Tuno. All rights reserved.
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

  const textContent = `비밀번호 재설정

아래 링크를 클릭하여 비밀번호를 재설정하세요.

${resetUrl}

${expiresIn}분 후 만료됩니다.
본인이 요청하지 않았다면 이 메일을 무시해주세요.
링크를 타인과 공유하지 마세요.

© ${year} Tuno. All rights reserved.
  `;

  const { error } = await resend.emails.send({
    from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
    to: [to],
    subject: "Tuno 비밀번호 재설정 안내",
    text: textContent,
    html: htmlContent,
  });

  if (error) {
    throw new Error(`이메일 발송 실패: ${error.message}`);
  }
}
