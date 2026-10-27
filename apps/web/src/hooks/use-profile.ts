'use client';
import { useQuery } from '@tanstack/react-query';
import type { Profile } from '@nuviora/types';
import { api } from '@/services/api';
export function useProfile() { return useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/auth/me') }); }
