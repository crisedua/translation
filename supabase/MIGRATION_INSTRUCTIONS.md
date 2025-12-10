-- Apply database migrations to Supabase

To apply the database schema to your Supabase project, you have two options:

## Option 1: Using Supabase Dashboard (Easiest)

1. Go to https://supabase.com/dashboard/project/fsqvguceukcyvyuekvbz
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the contents of `supabase/migrations/20231201000000_initial_schema.sql`
5. Click "Run" to execute the migration

## Option 2: Using Supabase CLI

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link to your project:
   ```bash
   supabase link --project-ref fsqvguceukcyvyuekvbz
   ```

4. Push the migration:
   ```bash
   supabase db push
   ```

## After Migration

Once the migration is applied, you'll have these tables:
- `document_categories` - Document types
- `document_templates` - PDF templates with field definitions
- `document_requests` - User submissions and extracted data
- `profiles` - User profiles
- `user_roles` - Admin/Moderator/User roles

All tables will have Row Level Security (RLS) enabled for security.
