import { v2 as cloudinary } from 'cloudinary';
import {
  buildSignedUploadParams,
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
  it('chữ ký khớp api_sign_request của SDK với cùng bộ {folder, public_id, timestamp}', () => {
    const params = buildSignedUploadParams(CFG, 'tourism/avatars/u-1', 'pid-1', 1_760_000_000);
    expect(params.signature).toBe(
      cloudinary.utils.api_sign_request(
        { folder: 'tourism/avatars/u-1', public_id: 'pid-1', timestamp: 1_760_000_000 },
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
    });
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
