import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import EmotionSelector from '../../components/EmotionSelector';

describe('EmotionSelector', () => {
  const mockOnEmotionSelect = jest.fn();

  beforeEach(() => {
    mockOnEmotionSelect.mockClear();
  });

  it('renders emotion selector with title', () => {
    const {getByText} = render(
      <EmotionSelector 
        selectedEmotion={null} 
        onEmotionSelect={mockOnEmotionSelect} 
      />
    );
    
    expect(getByText('How are you feeling?')).toBeTruthy();
  });

  it('renders all emotion options', () => {
    const {getByText} = render(
      <EmotionSelector 
        selectedEmotion={null} 
        onEmotionSelect={mockOnEmotionSelect} 
      />
    );
    
    // Check for some emotion options
    expect(getByText('🍽️ Surprise Me')).toBeTruthy();
    expect(getByText('😊 Happy')).toBeTruthy();
    expect(getByText('😢 Sad')).toBeTruthy();
    expect(getByText('🎉 Celebrating')).toBeTruthy();
  });

  it('highlights selected emotion', () => {
    const {getByText} = render(
      <EmotionSelector 
        selectedEmotion="happy" 
        onEmotionSelect={mockOnEmotionSelect} 
      />
    );
    
    const happyButton = getByText('😊 Happy').parent;
    expect(happyButton?.props.style).toContainEqual(
      expect.objectContaining({
        borderColor: '#FF6B35',
      })
    );
  });

  it('highlights "Surprise Me" when no emotion is selected', () => {
    const {getByText} = render(
      <EmotionSelector 
        selectedEmotion={null} 
        onEmotionSelect={mockOnEmotionSelect} 
      />
    );
    
    const surpriseButton = getByText('🍽️ Surprise Me').parent;
    expect(surpriseButton?.props.style).toContainEqual(
      expect.objectContaining({
        borderColor: '#FF6B35',
      })
    );
  });

  it('calls onEmotionSelect when emotion is pressed', () => {
    const {getByText} = render(
      <EmotionSelector 
        selectedEmotion={null} 
        onEmotionSelect={mockOnEmotionSelect} 
      />
    );
    
    fireEvent.press(getByText('😊 Happy'));
    expect(mockOnEmotionSelect).toHaveBeenCalledWith('happy');
  });

  it('calls onEmotionSelect with null when "Surprise Me" is pressed', () => {
    const {getByText} = render(
      <EmotionSelector 
        selectedEmotion="happy" 
        onEmotionSelect={mockOnEmotionSelect} 
      />
    );
    
    fireEvent.press(getByText('🍽️ Surprise Me'));
    expect(mockOnEmotionSelect).toHaveBeenCalledWith(null);
  });

  it('allows selecting different emotions', () => {
    const {getByText} = render(
      <EmotionSelector 
        selectedEmotion={null} 
        onEmotionSelect={mockOnEmotionSelect} 
      />
    );
    
    fireEvent.press(getByText('😢 Sad'));
    expect(mockOnEmotionSelect).toHaveBeenCalledWith('sad');
    
    fireEvent.press(getByText('🎉 Celebrating'));
    expect(mockOnEmotionSelect).toHaveBeenCalledWith('celebrating');
  });
});