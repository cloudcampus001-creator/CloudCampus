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
      const { data } = await supabase
        .from('vice_principals')
        .select('classes_managing')
        .eq('id', userId)
        .single();
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
    classId: selectedClass,
  };

  const chatHeight = 'calc(100vh - 130px)';

  return (
    <>
      <Helmet>
        <title>{t('chat')} - {t('role_vp')}</title>
      </Helmet>
      <div
        className="-mx-4 -mt-4 -mb-24 md:-mx-8 md:-mt-8 md:-mb-8 overflow-hidden md:h-screen"
        style={{ height: chatHeight }}
      >
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
