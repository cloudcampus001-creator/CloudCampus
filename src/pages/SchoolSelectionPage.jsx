import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { School, ArrowRight, Cloud, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import SearchableSelect from '@/components/SearchableSelect';

const SchoolSelectionPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [schools,        setSchools]        = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [loading,        setLoading]        = useState(true);

  useEffect(() => { fetchSchools(); }, []);

  const fetchSchools = async () => {
    try {
      const { data, error } = await supabase.from('schools').select('*');
      if (error) throw error;
      setSchools(data || []);
    } catch (err) {
      console.error('Error fetching schools:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load schools list.' });
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!selectedSchool) return;
    navigate(`/role-selection/${selectedSchool}`);
  };

  // Shape schools into SearchableSelect items
  const schoolItems = schools.map(s => ({
    value: s.id.toString(),
    label: s.name,
    // sub: s.location or s.city if those columns exist — drop it if not
    icon: <School className="w-4 h-4 text-primary" />,
  }));

  return (
    <>
      <Helmet><title>Select School - CloudCampus</title></Helmet>

      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[100px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[100px] animate-pulse delay-1000" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8 space-y-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="inline-flex p-4 rounded-full bg-primary/10 mb-4 ring-1 ring-primary/20"
            >
              <Cloud className="w-12 h-12 text-primary" />
            </motion.div>
            <h1 className="text-4xl font-bold text-glow">CloudCampus</h1>
            <p className="text-muted-foreground">The Future of School Management</p>
          </div>

          <Card className="glass border-t-4 border-t-primary">
            <CardHeader className="text-center">
              <CardTitle>Select Your School</CardTitle>
              <CardDescription>Choose your institution to proceed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Searchable, scrollable school picker */}
                  <SearchableSelect
                    items={schoolItems}
                    value={selectedSchool}
                    onChange={setSelectedSchool}
                    placeholder="Search or select your school…"
                    searchPlaceholder="Type school name…"
                    triggerClassName="h-14 text-base bg-background/50 backdrop-blur-sm"
                  />

                  <Button
                    className="w-full h-12 text-lg shadow-lg shadow-primary/20"
                    disabled={!selectedSchool}
                    onClick={handleContinue}
                  >
                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
};

export default SchoolSelectionPage;
