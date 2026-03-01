import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { School, ArrowRight, Cloud, Loader2, BookOpen, Users, Shield, Zap } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';

const LandingPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    try {
      const { data, error } = await supabase.from('schools').select('*');
      if (error) throw error;
      setSchools(data || []);
    } catch (error) {
      console.error('Error fetching schools:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load schools list."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!selectedSchool) return;
    navigate(`/role-selection/${selectedSchool}`);
  };

  return (
    <>
      <Helmet>
        <title>Welcome to CloudCampus</title>
      </Helmet>
      <div className="min-h-screen flex flex-col relative overflow-hidden font-sans selection:bg-primary selection:text-white">
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 bg-background">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[100px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[100px] animate-pulse delay-1000" />
          <div className="absolute top-[40%] left-[60%] w-[20%] h-[20%] rounded-full bg-blue-400/10 blur-[80px]" />
        </div>

        {/* Hero Section */}
        <header className="p-6 flex justify-between items-center glass sticky top-4 z-50 mx-4 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Cloud className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xl font-bold text-glow tracking-tight">Cloud<span className="text-primary">Campus</span></span>
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth'})}>Features</Button>
            <Button variant="ghost" onClick={() => document.getElementById('portal').scrollIntoView({ behavior: 'smooth'})}>Portal Login</Button>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center w-full max-w-7xl mx-auto px-4 py-12 lg:py-20">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full mb-24">
             {/* Text Content */}
             <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="space-y-8 text-center lg:text-left"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
                  <Zap className="w-4 h-4" /> Next-Gen School Management
                </div>
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
                  The Future of <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-blue-500 animate-gradient">
                    Education
                  </span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  Experience a seamless ecosystem connecting teachers, students, parents, and administrators. 
                  Real-time marks, discipline tracking, and instant communication.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
                  <Button 
                    size="lg" 
                    className="h-14 px-8 text-lg rounded-full shadow-[0_0_30px_rgba(var(--primary),0.3)] hover:shadow-[0_0_50px_rgba(var(--primary),0.5)] transition-all duration-300"
                    onClick={() => document.getElementById('portal').scrollIntoView({ behavior: 'smooth'})}
                  >
                    Access Portal <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-primary/20 hover:bg-primary/5">
                    Learn More
                  </Button>
                </div>
             </motion.div>

             {/* Login Card */}
             <motion.div
                id="portal"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="w-full max-w-md mx-auto"
              >
                <Card className="glass border-t-4 border-t-primary shadow-2xl backdrop-blur-xl bg-card/40">
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl">Select Your School</CardTitle>
                    <CardDescription>Choose your institution to proceed to login</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    {loading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Select onValueChange={setSelectedSchool} value={selectedSchool}>
                          <SelectTrigger className="h-14 text-lg bg-background/50 border-white/10 hover:border-primary/50 transition-colors">
                            <SelectValue placeholder="Search or select school..." />
                          </SelectTrigger>
                          <SelectContent>
                            {schools.map((school) => (
                              <SelectItem key={school.id} value={school.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <School className="w-4 h-4 text-primary" />
                                  <span>{school.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button 
                          className="w-full h-12 text-lg font-semibold shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 transition-all" 
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

          {/* Features Section */}
          <motion.div 
            id="features"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full px-4"
          >
            {[
              { icon: Zap, title: "Real-time Updates", desc: "Instant notifications for marks, attendance, and important announcements." },
              { icon: Users, title: "Seamless Collaboration", desc: "Direct communication channels bridging the gap between school and home." },
              { icon: Shield, title: "Secure & Reliable", desc: "Enterprise-grade security ensuring your data is protected around the clock." }
            ].map((feature, i) => (
              <Card key={i} className="glass border-t-4 border-t-transparent hover:border-t-primary transition-all duration-300 hover:-translate-y-2 bg-card/30">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                  <div className="p-4 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 mb-2">
                    <feature.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </motion.div>

        </main>

        <footer className="p-8 text-center text-muted-foreground/60 text-sm mt-auto border-t border-white/5 bg-background/50 backdrop-blur-sm">
          <p>&copy; 2025 CloudCampus. All rights reserved. Shaping the future of education.</p>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;