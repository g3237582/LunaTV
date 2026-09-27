import { fireEvent, render, screen } from '@testing-library/react';

import SleeveCard from './SleeveCard';

describe('SleeveCard cover', () => {
  it('renders a square lazy cover and falls back to the typographic sleeve when the image fails', () => {
    const { container } = render(
      <SleeveCard
        rank={1}
        name='飙升榜'
        cover='https://p1.music.126.net/album.jpg'
        onOpen={() => undefined}
      />
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'https://p1.music.126.net/album.jpg');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(img?.className).toContain('object-cover');
    expect(container.querySelector('.aspect-square')).not.toBeNull();

    if (!img) throw new Error('封面没有渲染出来');
    fireEvent.error(img);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('飙升榜')).toBeTruthy();
    expect(screen.getByText('01')).toBeTruthy();
  });
});
