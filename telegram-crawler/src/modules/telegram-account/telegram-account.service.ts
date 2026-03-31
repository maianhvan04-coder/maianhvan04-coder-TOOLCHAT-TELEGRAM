import { telegramClient } from "../../core/tdlib/telegram.client";

type TdOk = {
  "@type"?: string;
};

export const telegramAccountService = {
  async getStatus(): Promise<Record<string, unknown>> {
    return telegramClient.invoke({
      "@type": "getAuthorizationState",
    });
  },

  async sendPhoneNumber(phoneNumber: string): Promise<TdOk> {
    return telegramClient.invoke<TdOk>({
      "@type": "setAuthenticationPhoneNumber",
      phone_number: phoneNumber,
      settings: {
        "@type": "phoneNumberAuthenticationSettings",
        allow_flash_call: false,
        allow_missed_call: false,
        is_current_phone_number: false,
        has_unknown_phone_number: false,
        allow_sms_retriever_api: false,
        authentication_tokens: [],
      },
    });
  },

  async checkCode(code: string): Promise<TdOk> {
    return telegramClient.invoke<TdOk>({
      "@type": "checkAuthenticationCode",
      code,
    });
  },

  async checkPassword(password: string): Promise<TdOk> {
    return telegramClient.invoke<TdOk>({
      "@type": "checkAuthenticationPassword",
      password,
    });
  },

  async getMe(): Promise<Record<string, unknown>> {
    return telegramClient.invoke({
      "@type": "getMe",
    });
  },

  async logout(): Promise<TdOk> {
    return telegramClient.invoke<TdOk>({
      "@type": "logOut",
    });
  },
};