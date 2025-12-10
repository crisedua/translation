-- RLS Policies for document_categories
-- Allow public read access to categories
create policy "Allow public read access to document_categories"
  on document_categories for select
  using (true);

-- Allow authenticated users to insert categories
create policy "Allow authenticated users to insert categories"
  on document_categories for insert
  to authenticated
  with check (true);

-- Allow authenticated users to update categories
create policy "Allow authenticated users to update categories"
  on document_categories for update
  to authenticated
  using (true)
  with check (true);

-- Allow authenticated users to delete categories
create policy "Allow authenticated users to delete categories"
  on document_categories for delete
  to authenticated
  using (true);

-- RLS Policies for document_templates
-- Allow public read access to templates
create policy "Allow public read access to document_templates"
  on document_templates for select
  using (true);

-- Allow authenticated users to insert templates
create policy "Allow authenticated users to insert templates"
  on document_templates for insert
  to authenticated
  with check (true);

-- Allow authenticated users to update templates
create policy "Allow authenticated users to update templates"
  on document_templates for update
  to authenticated
  using (true)
  with check (true);

-- Allow authenticated users to delete templates
-- Allow public deletion of templates (TEMPORARY FIX for development)
create policy "Allow public delete access to document_templates"
  on document_templates for delete
  using (true);

-- RLS Policies for document_requests
-- Users can view their own requests
create policy "Users can view their own requests"
  on document_requests for select
  using (auth.uid() = user_id);

-- Users can insert their own requests
create policy "Users can insert their own requests"
  on document_requests for insert
  with check (auth.uid() = user_id);

-- Users can update their own requests
create policy "Users can update their own requests"
  on document_requests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS Policies for profiles
-- Users can view all profiles
create policy "Users can view all profiles"
  on profiles for select
  using (true);

-- Users can update their own profile
create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Users can insert their own profile
create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- RLS Policies for user_roles
-- Allow public read access to user_roles (needed for role checks)
create policy "Allow public read access to user_roles"
  on user_roles for select
  using (true);
