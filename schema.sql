-- Create the claude_search_data table
CREATE TABLE claude_search_data (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  
  -- Basic metrics
  search_count INTEGER NOT NULL DEFAULT 0,
  total_urls_discovered INTEGER NOT NULL DEFAULT 0,
  unique_domains INTEGER NOT NULL DEFAULT 0,
  citations_used INTEGER NOT NULL DEFAULT 0,
  citation_ratio DECIMAL(5,4) NOT NULL DEFAULT 0,
  final_response_length INTEGER NOT NULL DEFAULT 0,
  
  -- High priority metrics
  search_refinement_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
  citation_density DECIMAL(8,4) NOT NULL DEFAULT 0,
  average_domain_authority DECIMAL(4,2) NOT NULL DEFAULT 0,
  total_domains_with_citations INTEGER NOT NULL DEFAULT 0,
  search_query_similarity DECIMAL(5,4) NOT NULL DEFAULT 0,
  
  -- Timeline metrics
  avg_time_between_searches DECIMAL(8,2) NOT NULL DEFAULT 0,
  min_time_between_searches DECIMAL(8,2) NOT NULL DEFAULT 0,
  max_time_between_searches DECIMAL(8,2) NOT NULL DEFAULT 0,
  search_acceleration DECIMAL(8,4) NOT NULL DEFAULT 0,
  
  -- Domain performance
  most_cited_domain TEXT,
  least_cited_domain TEXT,
  
  -- JSON fields for complex data
  search_queries JSONB,
  domain_list JSONB,
  domain_inclusion_rate JSONB,
  domain_authority_data JSONB,
  citation_sources JSONB,
  unique_urls JSONB,
  
  -- Metadata
  query_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_claude_search_data_conversation_id ON claude_search_data(conversation_id);
CREATE INDEX idx_claude_search_data_timestamp ON claude_search_data(timestamp);
CREATE INDEX idx_claude_search_data_created_at ON claude_search_data(created_at);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_claude_search_data_updated_at 
    BEFORE UPDATE ON claude_search_data 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();