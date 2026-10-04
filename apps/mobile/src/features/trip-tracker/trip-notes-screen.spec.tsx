import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import { TripNotesScreen, type TripNotesScreenProps } from './trip-notes-screen';

function baseProps(overrides: Partial<TripNotesScreenProps> = {}): TripNotesScreenProps {
  return {
    whatToBringLabel: 'What to bring',
    whatToBringLines: ['ID or passport', 'Modest dress'],
    includedInYourFareLabel: 'Included in your fare',
    included: ['Hotels', 'Breakfast', 'Entrance tickets', 'Airport transfer', 'Guide'],
    showAllLabel: (n: number) => `Show all ${n}`,
    notIncludedLabel: 'Not included — sort these yourself',
    excluded: ['Flights', 'Travel insurance', 'Tips'],
    goodToKnowLabel: 'Good to know',
    goodToKnowCaption: '2 questions other travellers asked',
    faqs: [
      { question: 'Is it kid-friendly?', answer: 'Yes, ages 6 and up.' },
      { question: 'What shoes?', answer: 'Closed-toe walking shoes.' },
    ],
    ...overrides,
  };
}

describe('TripNotesScreen', () => {
  it('vẽ ba đầu mục và cắt included còn 3 + Show all', async () => {
    await renderWithTheme(<TripNotesScreen {...baseProps()} />);

    expect(screen.getByText('ID or passport')).toBeTruthy();
    expect(screen.getByText('Hotels')).toBeTruthy();
    expect(screen.getByText('Breakfast')).toBeTruthy();
    expect(screen.getByText('Entrance tickets')).toBeTruthy();
    expect(screen.queryByText('Airport transfer')).toBeNull();
    expect(screen.getByText('Show all 5')).toBeTruthy();
    expect(screen.getByText('Flights')).toBeTruthy();
  });

  it('bấm Show all thì hiện hết, nút biến mất', async () => {
    await renderWithTheme(<TripNotesScreen {...baseProps()} />);

    await fireEvent.press(screen.getByText('Show all 5'));
    expect(screen.getByText('Airport transfer')).toBeTruthy();
    expect(screen.getByText('Guide')).toBeTruthy();
    expect(screen.queryByText('Show all 5')).toBeNull();
  });

  it('included ≤ 3 dòng thì không có nút Show all', async () => {
    await renderWithTheme(
      <TripNotesScreen {...baseProps({ included: ['Hotels', 'Breakfast'] })} />,
    );

    expect(screen.queryByText(/Show all/)).toBeNull();
  });

  it('FAQ đóng theo mặc định, bấm "Good to know" mới xổ ra', async () => {
    await renderWithTheme(<TripNotesScreen {...baseProps()} />);

    expect(screen.queryByText('Is it kid-friendly?')).toBeNull();
    await fireEvent.press(screen.getByText('Good to know'));
    expect(screen.getByText('Is it kid-friendly?')).toBeTruthy();
    expect(screen.getByText('Yes, ages 6 and up.')).toBeTruthy();
  });
});
