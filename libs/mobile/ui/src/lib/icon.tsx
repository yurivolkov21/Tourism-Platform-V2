import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import type { FeatherIconName } from './text-field';

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Bảng đổi tên icon Feather sang bộ Material (N5, ADR-0040 AMEND 7): code gọi vẫn dùng tên
 * Feather đã có nên không phải sửa hàng trăm chỗ; tên nào chưa có trong bảng thì rơi về
 * Feather để không bao giờ vẽ ô trống. Thêm icon mới thì thêm một dòng ở đây.
 */
export const FEATHER_TO_MATERIAL = {
  'arrow-left': 'arrow-left',
  'arrow-right': 'arrow-right',
  'chevron-right': 'chevron-right',
  'chevron-left': 'chevron-left',
  'chevron-down': 'chevron-down',
  'chevron-up': 'chevron-up',
  'alert-circle': 'alert-circle-outline',
  'external-link': 'open-in-new',
  'check-circle': 'check-circle-outline',
  'x-circle': 'close-circle-outline',
  'credit-card': 'credit-card-outline',
  'help-circle': 'help-circle-outline',
  'file-text': 'file-document-outline',
  'map-pin': 'map-marker-outline',
  'message-square': 'message-outline',
  'refresh-cw': 'refresh',
  'trash-2': 'trash-can-outline',
  briefcase: 'briefcase-outline',
  calendar: 'calendar-outline',
  camera: 'camera-outline',
  check: 'check',
  clock: 'clock-outline',
  compass: 'compass-outline',
  edit: 'pencil-outline',
  eye: 'eye-outline',
  'eye-off': 'eye-off-outline',
  flag: 'flag-outline',
  heart: 'heart-outline',
  home: 'home-outline',
  image: 'image-outline',
  info: 'information-outline',
  key: 'key-outline',
  link: 'link-variant',
  loader: 'loading',
  lock: 'lock-outline',
  'log-out': 'logout',
  mail: 'email-outline',
  map: 'map-outline',
  minus: 'minus',
  phone: 'phone-outline',
  plus: 'plus',
  search: 'magnify',
  shield: 'shield-outline',
  sliders: 'tune-variant',
  smile: 'emoticon-outline',
  star: 'star-outline',
  user: 'account-outline',
  users: 'account-group-outline',
  'wifi-off': 'wifi-off',
  x: 'close',
  activity: 'pulse',
} as const satisfies Partial<Record<FeatherIconName, MaterialIconName>>;

export interface IconProps {
  /** Tên icon kiểu Feather — xem `FEATHER_TO_MATERIAL`. */
  name: FeatherIconName;
  size: number;
  color: string;
  testID?: string;
  style?: StyleProp<TextStyle>;
}

/** Icon của app: Material Community khi có tên tương ứng, còn lại là Feather. */
export function Icon({ name, size, color, testID, style }: IconProps) {
  const material = (FEATHER_TO_MATERIAL as Partial<Record<string, MaterialIconName>>)[name];

  if (material === undefined) {
    return <Feather testID={testID} name={name} size={size} color={color} style={style} />;
  }
  return (
    <MaterialCommunityIcons
      testID={testID}
      name={material}
      size={size}
      color={color}
      style={style}
    />
  );
}
