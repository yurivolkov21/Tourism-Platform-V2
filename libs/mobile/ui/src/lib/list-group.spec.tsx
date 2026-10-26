import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { renderWithTheme, themeFor } from '../test-utils';
import { ListGroup, ListRow } from './list-group';

function renderGroup(onPress = jest.fn()) {
  return renderWithTheme(
    <ListGroup label="Support" footer="Footer text">
      <ListRow icon="mail" title="First" subtitle="sub" value="v" onPress={onPress} />
      <ListRow icon="phone" title="Second" onPress={() => {}} />
      <ListRow icon="log-out" title="Third" destructive onPress={() => {}} />
    </ListGroup>,
  );
}

describe('ListGroup / ListRow', () => {
  it('hàng đầu bo trên 20, hàng cuối bo dưới 20, hàng giữa bo 4, cách nhau 2', async () => {
    await renderGroup();

    const first = StyleSheet.flatten(screen.getByRole('button', { name: /First/ }).props.style);
    const middle = StyleSheet.flatten(screen.getByRole('button', { name: /Second/ }).props.style);
    const last = StyleSheet.flatten(screen.getByRole('button', { name: /Third/ }).props.style);
    expect(first).toMatchObject({ borderTopLeftRadius: 20, borderBottomLeftRadius: 4 });
    expect(middle).toMatchObject({ borderTopLeftRadius: 4, borderBottomLeftRadius: 4 });
    expect(last).toMatchObject({ borderTopLeftRadius: 4, borderBottomLeftRadius: 20 });
    expect(screen.getByTestId('list-group-rows').props.style).toMatchObject({ gap: 2 });
  });

  it('hàng nền card, cao tối thiểu 56', async () => {
    const theme = themeFor('light');
    await renderGroup();

    const style = StyleSheet.flatten(screen.getByRole('button', { name: /First/ }).props.style);
    expect(style.backgroundColor).toBe(theme.colors.card);
    expect(style.minHeight).toBe(56);
  });

  it('một hàng đơn lẻ bo 20 cả bốn góc', async () => {
    await renderWithTheme(
      <ListGroup>
        <ListRow icon="mail" title="Only" onPress={() => {}} />
      </ListGroup>,
    );

    const style = StyleSheet.flatten(screen.getByRole('button', { name: /Only/ }).props.style);
    expect(style).toMatchObject({ borderTopLeftRadius: 20, borderBottomLeftRadius: 20 });
  });

  it('hiện nhãn nhóm, chân nhóm, dòng phụ, giá trị; bấm gọi onPress', async () => {
    const onPress = jest.fn();
    await renderGroup(onPress);

    expect(screen.getByText('Support')).toBeTruthy();
    expect(screen.getByText('Footer text')).toBeTruthy();
    expect(screen.getByText('sub')).toBeTruthy();
    expect(screen.getByText('v')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /First/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('hàng phá huỷ chữ destructive-emphasis', async () => {
    const theme = themeFor('light');
    await renderGroup();

    const text = StyleSheet.flatten(screen.getByText('Third').props.style);
    expect(text.color).toBe(theme.colors['destructive-emphasis']);
  });

  it('nhãn nhóm 14 medium màu primary-emphasis', async () => {
    const theme = themeFor('light');
    await renderGroup();

    const label = StyleSheet.flatten(screen.getByText('Support').props.style);
    expect(label.color).toBe(theme.colors['primary-emphasis']);
    expect(label.fontSize).toBe(14);
  });

  it('hàng chỉ để đọc (không onPress): không có vai button, không có mũi tên', async () => {
    await renderWithTheme(
      <ListGroup>
        <ListRow title="Name" value="Minh Anh" />
      </ListGroup>,
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Name, Minh Anh')).toBeTruthy();
  });
});
