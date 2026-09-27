import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test-utils';
import {
  PostDetailScreen,
  type PostDetailScreenProps,
  type RelatedTourVM,
} from './post-detail-screen';

function tour(overrides: Partial<RelatedTourVM> = {}): RelatedTourVM {
  return {
    slug: 'sapa-terraces-homestay-2d',
    title: 'Sa Pa Terraces & Homestay Trek 2D1N',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/sapa/hero',
    durationLabel: '2 days · Moderate',
    priceLabel: '$119',
    ...overrides,
  };
}

function baseProps(overrides: Partial<PostDetailScreenProps> = {}): PostDetailScreenProps {
  return {
    status: 'content',
    coverUrl: 'https://res.cloudinary.com/demo/image/upload/mist/hero',
    title: 'What to pack for the mist season',
    tagLabels: ['Packing', 'Sa Pa'],
    authorName: 'Nexora Travel',
    authorInitials: 'NT',
    dateLabel: '22 Jul 2026',
    blocks: [
      { type: 'heading', text: 'Layers beat one big coat' },
      { type: 'paragraph', text: 'Sa Pa runs cold at 6am and warm by noon.' },
    ],
    relatedTours: [tour()],
    relatedToursTitle: 'Trips in this story',
    readOnWebLabel: 'Read this on nexora-travel.agency',
    onReadOnWeb: jest.fn(),
    onBack: jest.fn(),
    backLabel: 'Back',
    onTourPress: jest.fn(),
    errorTitle: "Couldn't load this story.",
    retryLabel: 'Try again',
    onRetry: jest.fn(),
    ...overrides,
  };
}

describe('PostDetailScreen', () => {
  it('G3 — vẽ tiêu đề, tác giả, ngày, và các khối markdown đã parse', async () => {
    await renderWithTheme(<PostDetailScreen {...baseProps()} />);
    expect(screen.getByText('What to pack for the mist season')).toBeTruthy();
    expect(screen.getByText('Nexora Travel')).toBeTruthy();
    expect(screen.getByText('22 Jul 2026')).toBeTruthy();
    expect(screen.getByText('Layers beat one big coat')).toBeTruthy();
    expect(screen.getByText('Sa Pa runs cold at 6am and warm by noon.')).toBeTruthy();
  });

  it('bấm nút back gọi onBack, bấm nút mở web gọi onReadOnWeb', async () => {
    const onBack = jest.fn();
    const onReadOnWeb = jest.fn();
    await renderWithTheme(<PostDetailScreen {...baseProps({ onBack, onReadOnWeb })} />);
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Read this on nexora-travel.agency'));
    expect(onReadOnWeb).toHaveBeenCalled();
  });

  it('G4 — relatedTours không rỗng: vẽ tiêu đề khối + hàng tour, bấm gọi onTourPress', async () => {
    const onTourPress = jest.fn();
    await renderWithTheme(<PostDetailScreen {...baseProps({ onTourPress })} />);
    expect(screen.getByText('Trips in this story')).toBeTruthy();
    expect(screen.getByText('Sa Pa Terraces & Homestay Trek 2D1N')).toBeTruthy();
    await fireEvent.press(screen.getByText('Sa Pa Terraces & Homestay Trek 2D1N'));
    expect(onTourPress).toHaveBeenCalledWith('sapa-terraces-homestay-2d');
  });

  it('relatedTours rỗng: KHÔNG hiện tiêu đề khối (spec §"mảng rỗng ẩn cả khối")', async () => {
    await renderWithTheme(<PostDetailScreen {...baseProps({ relatedTours: [] })} />);
    expect(screen.queryByText('Trips in this story')).toBeNull();
  });

  it('status="error" hiện errorTitle + nút retry', async () => {
    const onRetry = jest.fn();
    await renderWithTheme(<PostDetailScreen {...baseProps({ status: 'error', onRetry })} />);
    expect(screen.getByText("Couldn't load this story.")).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalled();
  });
});
