import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RiderCard from '../../src/features/clubs/RiderCard';
import type { RaceData } from '../../src/shared/api/types';

const baseRacer: RaceData = {
  raceCount: 5,
  points: 30,
  roadAndTrackPoints: 30,
  cyclocrossPoints: 0,
  roadAndTrackRaceCount: 5,
  cyclocrossRaceCount: 0,
  category: '3rd',
  name: 'Alice Example',
  club: 'Test Club',
  regionalPoints: 25,
  nationalPoints: 5,
  roadRegionalPoints: 25,
  roadNationalPoints: 5,
  cxRegionalPoints: 0,
  cxNationalPoints: 0,
};

describe('RiderCard', () => {
  it('renders the rider name, club, category and stat badges', () => {
    render(<RiderCard racerId="42" racer={baseRacer} year="2025" />);
    expect(screen.getByText('Alice Example')).toBeInTheDocument();
    expect(screen.getByText(/Club: Test Club/)).toBeInTheDocument();
    expect(screen.getByText(/Total Races: 5/)).toBeInTheDocument();
    expect(screen.getByText(/Road & Track: 5 races/)).toBeInTheDocument();
    expect(screen.getByText(/Road & Track: 30 pts/)).toBeInTheDocument();
    expect(screen.getByText(/Road Regional: 25 pts/)).toBeInTheDocument();
    expect(screen.getByText(/Road National: 5 pts/)).toBeInTheDocument();
  });

  it('links Road Results back to the British Cycling site', () => {
    render(<RiderCard racerId="42" racer={baseRacer} year="2025" />);
    const link = screen.getByRole('link', { name: /Road Results/ });
    expect(link).toHaveAttribute(
      'href',
      'https://www.britishcycling.org.uk/points?d=4&person_id=42&year=2025',
    );
  });

  it('hides the road results button when the rider has no Road & Track races', () => {
    render(
      <RiderCard
        racerId="1"
        racer={{ ...baseRacer, roadAndTrackRaceCount: 0 }}
        year="2025"
      />,
    );
    expect(screen.queryByRole('link', { name: /Road Results/ })).not.toBeInTheDocument();
  });
});
