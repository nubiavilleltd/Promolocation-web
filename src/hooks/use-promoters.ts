import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreatePromoterPayload,
  CreatePromoterResponse,
  Promoter,
  ResetPromoterPasswordPayload,
  ResetPromoterPasswordResponse,
  UpdatePromoterPayload,
  UpdatePromoterResponse,
} from "../../types/promoters";
import {
  createPromoter,
  getPromoters,
  resetPromoterPassword,
  updatePromoter,
} from "../api/promoters";

export function usePromoters(enabled = true) {
  return useQuery<Promoter[], Error>({
    queryKey: ["promoters"],
    queryFn: getPromoters,
    enabled,
  });
}


export function useCreatePromoter(){
    const queryClient = useQueryClient();
    return useMutation<CreatePromoterResponse, Error, CreatePromoterPayload>({
    mutationFn: createPromoter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promoters"] });
    },
  });
}

export function useUpdatePromoter() {
  const queryClient = useQueryClient();

  return useMutation<UpdatePromoterResponse, Error, UpdatePromoterPayload>({
    mutationFn: updatePromoter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promoters"] });
    },
  });
}

export function useResetPromoterPassword() {
  return useMutation<
    ResetPromoterPasswordResponse,
    Error,
    ResetPromoterPasswordPayload
  >({
    mutationFn: resetPromoterPassword,
  });
}
