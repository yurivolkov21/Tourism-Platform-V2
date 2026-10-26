import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import { screen } from '@testing-library/react-native';
import { renderWithTheme } from '../test-utils';
import { FEATHER_TO_MATERIAL, Icon } from './icon';

describe('Icon', () => {
  it.each(Object.entries(FEATHER_TO_MATERIAL))(
    'Feather "%s" ánh xạ sang glyph Material "%s" CÓ THẬT',
    (_feather, material) => {
      expect(Object.keys(glyphs)).toContain(material);
    },
  );

  it('tên có trong bảng ánh xạ thì vẽ bằng Material', async () => {
    await renderWithTheme(<Icon name="mail" size={24} color="#000000" testID="icon" />);

    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it('tên chưa có trong bảng thì rơi về Feather, không vỡ', async () => {
    await renderWithTheme(<Icon name="anchor" size={24} color="#000000" testID="icon" />);

    expect(screen.getByTestId('icon')).toBeTruthy();
  });
});
