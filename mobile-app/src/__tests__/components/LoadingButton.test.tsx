import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import LoadingButton from '../../components/LoadingButton';

describe('LoadingButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders with title', () => {
    const {getByText} = render(
      <LoadingButton title="Test Button" onPress={mockOnPress} />
    );
    
    expect(getByText('Test Button')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const {getByText} = render(
      <LoadingButton title="Test Button" onPress={mockOnPress} />
    );
    
    fireEvent.press(getByText('Test Button'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('shows loading indicator when loading', () => {
    const {queryByText, UNSAFE_getByType} = render(
      <LoadingButton title="Test Button" onPress={mockOnPress} loading={true} />
    );
    
    // Title should not be visible when loading
    expect(queryByText('Test Button')).toBeNull();
    
    // ActivityIndicator should be present
    expect(UNSAFE_getByType('ActivityIndicator')).toBeTruthy();
  });

  it('is disabled when loading', () => {
    const {getByRole} = render(
      <LoadingButton title="Test Button" onPress={mockOnPress} loading={true} />
    );
    
    const button = getByRole('button');
    fireEvent.press(button);
    
    // onPress should not be called when loading
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('is disabled when disabled prop is true', () => {
    const {getByRole} = render(
      <LoadingButton title="Test Button" onPress={mockOnPress} disabled={true} />
    );
    
    const button = getByRole('button');
    fireEvent.press(button);
    
    // onPress should not be called when disabled
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('applies custom styles', () => {
    const customStyle = {backgroundColor: 'red'};
    const customTextStyle = {color: 'blue'};
    
    const {getByText, getByRole} = render(
      <LoadingButton 
        title="Test Button" 
        onPress={mockOnPress} 
        style={customStyle}
        textStyle={customTextStyle}
      />
    );
    
    const button = getByRole('button');
    const text = getByText('Test Button');
    
    expect(button.props.style).toContainEqual(customStyle);
    expect(text.props.style).toContainEqual(customTextStyle);
  });
});