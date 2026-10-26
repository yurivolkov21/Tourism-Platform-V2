import { screen } from '@testing-library/react-native';
import { renderWithTheme } from '../test-utils';
import { AuroraGradient } from './aurora-gradient';

describe('AuroraGradient', () => {
  it('dựng được lớp nền, không chặn chạm', async () => {
    await renderWithTheme(<AuroraGradient intensity={0.4} />);

    const layer = screen.getByTestId('aurora-gradient');
    expect(layer.props.pointerEvents).toBe('none');
  });
});
