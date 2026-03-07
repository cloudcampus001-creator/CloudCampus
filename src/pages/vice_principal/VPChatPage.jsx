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

  return (
    <>
      <Helmet>
        <title>{t('chat')} - {t('role_vp')}</title>
      </Helmet>
      {/* Full height, no padding — chat fills the entire page area */}
      <div className="h-full w-full overflow-hidden">
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
