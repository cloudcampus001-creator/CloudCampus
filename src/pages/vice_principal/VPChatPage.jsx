import React, { useEffect, useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useLanguage } from '@/contexts/LanguageContext';

const VPChatPage = ({ selectedClass }) => {
  const { t } = useLanguage();
  const userId = localStorage.getItem('userId');
  const schoolId = localStorage.getItem('schoolId');
  
  const [classesManaging, setClassesManaging] = useState([]);

  useEffect(() => {
     const fetchVPDetails = async () => {
        if (!userId) return;
        const { data } = await supabase.from('vice_principals').select('classes_managing').eq('id', userId).single();
        if (data && data.classes_managing) {
           setClassesManaging(data.classes_managing);
        }
     };
     fetchVPDetails();
  }, [userId]);

  const identityName = "Vice Principal";
  const role = "vice_principal";

  const relatedContext = {
     schoolId: schoolId ? parseInt(schoolId) : null,
     classesManaging: classesManaging,
     classId: selectedClass // Pass specific class ID to context so ChatInterface can filter
  };

  return (
    <>
      <Helmet>
        <title>{t('chat')} - {t('role_vp')}</title>
      </Helmet>
      <div className="p-4 h-full max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{t('staffComm')}</h1>
          <p className="text-muted-foreground">{t('staffCommDesc')}</p>
        </div>
        <ChatInterface 
           currentUserRole={role}
           currentUserId={userId}
           currentUserName={identityName}
           relatedContext={relatedContext}
        />
      </div>
    </>
  );
};

export default VPChatPage;