-- Restaurant Database Initialization Script
-- This script sets up the initial schema for restaurant and review data

-- Create restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cuisine_type TEXT[] DEFAULT '{}',
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    district VARCHAR(100),
    price_range INTEGER CHECK (price_range >= 1 AND price_range <= 4),
    rating DECIMAL(3, 2) DEFAULT 0,
    negative_score DECIMAL(3, 2) DEFAULT 0,
    atmosphere TEXT[] DEFAULT '{}',
    operating_hours JSONB DEFAULT '{}',
    menu_highlights JSONB DEFAULT '[]',
    special_features TEXT[] DEFAULT '{}',
    is_local_gem BOOLEAN DEFAULT FALSE,
    authenticity_score DECIMAL(3, 2) DEFAULT 0,
    government_license JSONB DEFAULT '{}',
    data_quality_score DECIMAL(3, 2) DEFAULT 0,
    negative_feedback_trends JSONB DEFAULT '[]',
    platform_data JSONB DEFAULT '[]',
    last_sync_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for restaurants
CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants(name);
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine_type ON restaurants USING GIN(cuisine_type);
CREATE INDEX IF NOT EXISTS idx_restaurants_district ON restaurants(district);
CREATE INDEX IF NOT EXISTS idx_restaurants_price_range ON restaurants(price_range);
CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON restaurants(rating);
CREATE INDEX IF NOT EXISTS idx_restaurants_negative_score ON restaurants(negative_score);
CREATE INDEX IF NOT EXISTS idx_restaurants_location ON restaurants(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_restaurants_is_local_gem ON restaurants(is_local_gem);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    content TEXT,
    photos TEXT[] DEFAULT '{}',
    visit_date TIMESTAMP WITH TIME ZONE,
    is_verified BOOLEAN DEFAULT FALSE,
    authenticity_score DECIMAL(3, 2) DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    negative_score DECIMAL(3, 2) DEFAULT 0,
    negative_feedback_categories JSONB DEFAULT '[]',
    sentiment_analysis JSONB DEFAULT '{}',
    source VARCHAR(50) DEFAULT 'internal',
    external_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for reviews
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_id ON reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_source ON reviews(source);
CREATE INDEX IF NOT EXISTS idx_reviews_external_id ON reviews(external_id);
CREATE INDEX IF NOT EXISTS idx_reviews_authenticity_score ON reviews(authenticity_score);
CREATE INDEX IF NOT EXISTS idx_reviews_negative_score ON reviews(negative_score);
CREATE INDEX IF NOT EXISTS idx_reviews_visit_date ON reviews(visit_date);

-- Create menu items table
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2),
    category VARCHAR(100),
    is_signature BOOLEAN DEFAULT FALSE,
    is_seasonal BOOLEAN DEFAULT FALSE,
    dietary_info TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for menu items
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_signature ON menu_items(is_signature);

-- Create data sync logs table
CREATE TABLE IF NOT EXISTS data_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(100) NOT NULL,
    sync_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    records_processed INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    error_details JSONB DEFAULT '[]',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for sync logs
CREATE INDEX IF NOT EXISTS idx_data_sync_logs_source ON data_sync_logs(source);
CREATE INDEX IF NOT EXISTS idx_data_sync_logs_status ON data_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_data_sync_logs_started_at ON data_sync_logs(started_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for development (optional)
INSERT INTO restaurants (name, cuisine_type, address, district, price_range, rating) VALUES
('Demo Restaurant', ARRAY['cantonese'], '123 Demo Street, Central', 'Central', 3, 4.2),
('Sample Eatery', ARRAY['italian'], '456 Sample Road, Tsim Sha Tsui', 'Tsim Sha Tsui', 2, 3.8)
ON CONFLICT DO NOTHING;