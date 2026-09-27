import { messages } from '@tourism/i18n';
import {
  type AvatarActions,
  applyAvatarPick,
  imageExtensionOfMime,
  removeAvatar,
  validateAvatarAsset,
} from './avatar-flow';

const { avatar } = messages.mobile.account;

describe('imageExtensionOfMime', () => {
  it('MIME whitelist → đuôi contract', () => {
    expect(imageExtensionOfMime('image/jpeg')).toBe('jpg');
    expect(imageExtensionOfMime('image/png')).toBe('png');
    expect(imageExtensionOfMime('image/webp')).toBe('webp');
  });
  it('MIME lạ hoặc thiếu → null (kể cả heic — Cloudinary lưu nhưng không decode được)', () => {
    expect(imageExtensionOfMime('image/heic')).toBeNull();
    expect(imageExtensionOfMime(undefined)).toBeNull();
    expect(imageExtensionOfMime(null)).toBeNull();
  });
});

describe('validateAvatarAsset', () => {
  it('đúng MIME, dưới trần → null (hợp lệ)', () => {
    expect(validateAvatarAsset({ mimeType: 'image/jpeg', fileSize: 1024 })).toBeNull();
  });
  it('MIME sai → notImage', () => {
    expect(validateAvatarAsset({ mimeType: 'application/pdf', fileSize: 100 })).toBe('notImage');
  });
  it('vượt trần AVATAR_MAX_BYTES (2MB) → tooLarge', () => {
    expect(validateAvatarAsset({ mimeType: 'image/png', fileSize: 3 * 1024 * 1024 })).toBe(
      'tooLarge',
    );
  });
  it('fileSize thiếu → bỏ qua kiểm dung lượng, không chặn', () => {
    expect(validateAvatarAsset({ mimeType: 'image/png', fileSize: undefined })).toBeNull();
  });
});

function fakeParams() {
  return {
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
}

describe('applyAvatarPick', () => {
  it('MIME sai → error notImage, KHÔNG gọi signUpload', async () => {
    const signUpload = jest.fn();
    const actions: AvatarActions = {
      signUpload,
      uploadFile: jest.fn(),
      setAvatar: jest.fn(),
    };
    const outcome = await applyAvatarPick(
      { uri: 'file:///a.pdf', mimeType: 'application/pdf' },
      actions,
    );
    expect(outcome).toEqual({ kind: 'error', text: avatar.errNotImage });
    expect(signUpload).not.toHaveBeenCalled();
  });

  it('hợp lệ → sign → upload → setAvatar, trả done kèm image mới', async () => {
    const params = fakeParams();
    const actions: AvatarActions = {
      signUpload: jest.fn().mockResolvedValue(params),
      uploadFile: jest.fn().mockResolvedValue('tourism/avatars/u-1/pid-1'),
      setAvatar: jest
        .fn()
        .mockResolvedValue({ image: 'https://res.cloudinary.com/demo/pid-1.jpg' }),
    };
    const outcome = await applyAvatarPick(
      { uri: 'file:///a.jpg', mimeType: 'image/jpeg', fileSize: 1024 },
      actions,
    );
    expect(actions.signUpload).toHaveBeenCalledWith({ purpose: 'AVATAR', ext: 'jpg' });
    expect(actions.uploadFile).toHaveBeenCalledWith('file:///a.jpg', 'jpg', params);
    expect(actions.setAvatar).toHaveBeenCalledWith('tourism/avatars/u-1/pid-1');
    expect(outcome).toEqual({ kind: 'done', image: 'https://res.cloudinary.com/demo/pid-1.jpg' });
  });

  it('setAvatar lỗi (ORPCError hay lỗi mạng của uploadFile) → error chung, không throw', async () => {
    const actions: AvatarActions = {
      signUpload: jest.fn().mockResolvedValue(fakeParams()),
      uploadFile: jest.fn().mockRejectedValue(new Error('network')),
      setAvatar: jest.fn(),
    };
    const outcome = await applyAvatarPick({ uri: 'file:///a.png', mimeType: 'image/png' }, actions);
    expect(outcome).toEqual({ kind: 'error', text: avatar.errUpload });
    expect(actions.setAvatar).not.toHaveBeenCalled();
  });
});

describe('removeAvatar', () => {
  it('gọi setAvatar(null), trả done kèm image null', async () => {
    const setAvatar = jest.fn().mockResolvedValue({ image: null });
    const outcome = await removeAvatar({ setAvatar });
    expect(setAvatar).toHaveBeenCalledWith(null);
    expect(outcome).toEqual({ kind: 'done', image: null });
  });

  it('setAvatar lỗi → error chung', async () => {
    const setAvatar = jest.fn().mockRejectedValue(new Error('down'));
    const outcome = await removeAvatar({ setAvatar });
    expect(outcome).toEqual({ kind: 'error', text: avatar.errUpload });
  });
});
