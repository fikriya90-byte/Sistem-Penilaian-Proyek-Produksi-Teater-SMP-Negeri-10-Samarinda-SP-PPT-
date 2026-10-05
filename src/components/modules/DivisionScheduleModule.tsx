import React, { useState, useEffect } from 'react';
import { Users, PlusCircle, Calendar, Lock } from 'lucide-react';
import { useAuth } from '../../core/authContext';
import { useToast } from '../common/Toast';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { HorizontalCarousel } from '../common/HorizontalCarousel';

export const DivisionScheduleModule: React.FC = () => {
  const { user, activeClass } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');

  const isKoordinator = user?.role.startsWith('Koordinator ');
  const isAnggota = user?.role.startsWith('Anggota ');
  const myDivision = user?.divisionName || '';

  useEffect(() => {
    if (!activeClass || !myDivision) return;
    const q = query(
      collection(db, 'divisionSchedules'),
      where('classId', '==', activeClass.id),
      where('divisionName', '==', myDivision)
    );
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      list.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setItems(list);
    });
  }, [activeClass, myDivision]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClass || !title.trim() || !date) return;
    const
