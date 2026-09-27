import { buildUploadFields } from './media-upload';

const PARAMS = {
  signature: 'sig',
  timestamp: 1_760_000_000,
  apiKey: 'key',
  cloudName: 'demo',
  folder: 'tourism/avatars/u-1',
  publicId: 'pid-1',
  allowedFormats: 'jpg,jpeg,png,webp,avif,gif',
  transformation: 'c_limit,w_2400,h_2400,fl_force_strip',
  overwrite: false as const,
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
};

describe('buildUploadFields', () => {
  it('trả ĐÚNG bộ field chữ ký phủ — không kèm file (RN FormData không .get() được)', () => {
    const fields = buildUploadFields(PARAMS);
    expect(fields).toEqual({
      api_key: 'key',
      timestamp: '1760000000',
      signature: 'sig',
      folder: 'tourism/avatars/u-1',
      public_id: 'pid-1',
      allowed_formats: 'jpg,jpeg,png,webp,avif,gif',
      transformation: 'c_limit,w_2400,h_2400,fl_force_strip',
      overwrite: 'false',
    });
  });
});
