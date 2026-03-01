import React, { useEffect, useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useLanguage } from '@/contexts/LanguageContext';

const TeacherChatPage = () => {
  const { t } = useLanguage();
  const userId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName');
  const schoolId = localStorage.getItem('schoolId');
  
  const [identityName, setIdentityName] = useState(`${userName} (${t('role_teacher')})`);
  const [classesTeaching, setClassesTeaching] = useState([]);

  useEffect(() => {
    const fetchTeacherDetails = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from('teachers')
        .select('subjects, classes_teaching')
        .eq('id', userId)
        .single();
        
      if (data) {
        if (data.subjects && data.subjects.length > 0) {
          const subjectsStr = data.subjects.join(' & ');
          setIdentityName(`${subjectsStr} ${t('subjectTeacher')}`);
        }
        if (data.classes_teaching) {
           setClassesTeaching(data.classes_teaching);
        }
      }
    };
    fetchTeacherDetails();
  }, [userId, t]);

  const role = 'teacher';
  
  const relatedContext = {
    schoolId: schoolId ? parseInt(schoolId) : null,
    classesTeaching: classesTeaching
  };

  return (
    <>
      <Helmet>
        <title>{t('chat')} - {t('role_teacher')}</title>
      </Helmet>
      <div className="p-4 h-full max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{t('staffClassChat')}</h1>
          <p className="text-muted-foreground">{t('staffClassDesc')}</p>
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

export default TeacherChatPage;