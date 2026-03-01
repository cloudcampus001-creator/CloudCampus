import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Mail, Send, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Helmet } from 'react-helmet';

const ContactUsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSending(true);
    
    // Simulate sending
    setTimeout(() => {
      setSending(false);
      toast({
        title: t('success'),
        description: t('contactSuccess'),
      });
      setFormData({ name: '', email: '', message: '' });
    }, 1500);
  };

  return (
    <>
      <Helmet>
        <title>{t('contactUs')} - CloudCampus</title>
      </Helmet>
      <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl -z-10" />
        
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('back')}
          </Button>
        </div>

        <div className="max-w-5xl mx-auto w-full px-6 pb-20 grid md:grid-cols-2 gap-12 items-start">
          
          {/* Info Side */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div>
              <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
                {t('getInTouch')}
              </h1>
              <p className="text-muted-foreground text-lg">
                {t('contactDesc')}
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-white/5">
                <MapPin className="w-6 h-6 text-indigo-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Headquarters</h3>
                  <p className="text-sm text-muted-foreground">123 Innovation Blvd, Tech District<br />Cloud City, CC 90210</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-white/5">
                <Mail className="w-6 h-6 text-purple-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Email Us</h3>
                  <p className="text-sm text-muted-foreground">support@cloudcampus.com</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-white/5">
                <Phone className="w-6 h-6 text-pink-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Call Us</h3>
                  <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Form Side */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-card/30 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">{t('name')}</Label>
                <Input 
                  id="name" 
                  required 
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="bg-background/50"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input 
                  id="email" 
                  type="email" 
                  required 
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="bg-background/50"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message">{t('message')}</Label>
                <Textarea 
                  id="message" 
                  required 
                  placeholder={t('typeMessage')}
                  className="min-h-[150px] bg-background/50"
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                />
              </div>

              <Button 
                type="submit" 
                disabled={sending}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {sending ? t('sending') : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {t('sendMessage')}
                  </>
                )}
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default ContactUsPage;