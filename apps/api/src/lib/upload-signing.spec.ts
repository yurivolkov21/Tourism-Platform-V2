import { ALLOWED_IMAGE_EXTENSIONS } from '@tourism/contract';
import { v2 as cloudinary } from 'cloudinary';
import {
  ALLOWED_UPLOAD_FORMATS,
  buildSignedUploadParams,
  INCOMING_TRANSFORMATION,
  isOwnAvatarPublicId,
  resolveUploadConfig,
  uploadFolderFor,
} from './upload-signing.js';

const CFG = {
  cloudName: 'demo-cloud',
  apiKey: 'key-123',
  apiSecret: 'secret-abc',
  rootFolder: 'tourism',
};

describe('resolveUploadConfig', () => {
  it('đủ cặp key/secret → config; thiếu một trong hai → null (API vẫn boot, ADR-0021 §6)', () => {
    const base = {
      CLOUDINARY_CLOUD_NAME: 'demo-cloud',
      CLOUDINARY_UPLOAD_FOLDER: 'tourism',
    };
    expect(
      resolveUploadConfig({ ...base, CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's' }),
    ).toEqual({ cloudName: 'demo-cloud', apiKey: 'k', apiSecret: 's', rootFolder: 'tourism' });
    expect(resolveUploadConfig(base)).toBeNull();
    expect(resolveUploadConfig({ ...base, CLOUDINARY_API_KEY: 'k' })).toBeNull();
  });
});

describe('uploadFolderFor', () => {
  it('AVATAR → <root>/avatars/<userId>; REVIEW_PHOTO → <root>/reviews/<bookingCode>', () => {
    expect(uploadFolderFor('tourism', { purpose: 'AVATAR', userId: 'u-1' })).toBe(
      'tourism/avatars/u-1',
    );
    expect(
      uploadFolderFor('tourism', { purpose: 'REVIEW_PHOTO', bookingCode: 'BK-ABCD1234' }),
    ).toBe('tourism/reviews/BK-ABCD1234');
  });
});

describe('buildSignedUploadParams', () => {
  it('W4 U1 (ADR-0021 AMEND 1): chữ ký phủ CẢ allowed_formats + transformation — khớp api_sign_request', () => {
    const params = buildSignedUploadParams(CFG, 'tourism/avatars/u-1', 'pid-1', 1_760_000_000);
    expect(params.signature).toBe(
      cloudinary.utils.api_sign_request(
        {
          folder: 'tourism/avatars/u-1',
          public_id: 'pid-1',
          timestamp: 1_760_000_000,
          allowed_formats: ALLOWED_UPLOAD_FORMATS,
          transformation: INCOMING_TRANSFORMATION,
          overwrite: false,
        },
        CFG.apiSecret,
      ),
    );
    expect(params).toMatchObject({
      timestamp: 1_760_000_000,
      apiKey: 'key-123',
      cloudName: 'demo-cloud',
      folder: 'tourism/avatars/u-1',
      publicId: 'pid-1',
      uploadUrl: 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
      // Hai ràng buộc NẰM TRONG chữ ký — client thiếu/sửa là Cloudinary 401.
      allowedFormats: ALLOWED_UPLOAD_FORMATS,
      transformation: INCOMING_TRANSFORMATION,
      // Vòng vá review W4: overwrite=false NẰM TRONG chữ ký — POST lại cùng
      // public_id trong 10′ chữ ký còn hạn không tráo được ảnh đã duyệt.
      overwrite: false,
    });
  });

  it('W4 U1 (+ vòng vá review): format ký = MỘT nguồn với whitelist đuôi contract; transformation có fl_force_strip', () => {
    expect(ALLOWED_UPLOAD_FORMATS).toBe(ALLOWED_IMAGE_EXTENSIONS.join(','));
    expect(ALLOWED_UPLOAD_FORMATS).toBe('jpg,jpeg,png,webp,avif,gif');
    expect(INCOMING_TRANSFORMATION).toBe('c_limit,w_2400,h_2400,fl_force_strip');
  });
});

describe('isOwnAvatarPublicId', () => {
  it('đúng folder avatar của chính user → true; user khác / folder khác / prefix giả → false', () => {
    expect(isOwnAvatarPublicId('tourism', 'u-1', 'tourism/avatars/u-1/pid')).toBe(true);
    expect(isOwnAvatarPublicId('tourism', 'u-1', 'tourism/avatars/u-2/pid')).toBe(false);
    expect(isOwnAvatarPublicId('tourism', 'u-1', 'tourism/reviews/BK-X/pid')).toBe(false);
    // Prefix giả kiểu "u-1-evil" không được lọt — phải so theo SEGMENT.
    expect(isOwnAvatarPublicId('tourism', 'u-1', 'tourism/avatars/u-1-evil/pid')).toBe(false);
  });
});
