declare module "google-news-decoder" {
  interface DecodeResult {
    decodedUrl: string | null;
    [key: string]: unknown;
  }

  class GoogleNewsDecoder {
    decodeGoogleNewsUrl(url: string): Promise<DecodeResult>;
  }

  export default GoogleNewsDecoder;
}

