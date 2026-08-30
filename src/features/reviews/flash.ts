const reviewNoticeMessages = {
  submitted: "Thanks for your review. It is now pending moderation.",
  updated: "Your review was updated and sent back for moderation.",
} as const;

const reviewErrorMessages = {
  invalidInput: "Please review your rating and comment, then try again.",
  signInRequired: "Please sign in to submit a review.",
  purchaseRequired: "Only customers with a delivered order can leave a review.",
  notFound: "We could not find this item for reviewing.",
  rateLimited: "Too many review updates in a short time. Please wait a few minutes and try again.",
  submitFailed: "Your review could not be submitted right now. Please try again.",
} as const;

export type ReviewNoticeCode = keyof typeof reviewNoticeMessages;
export type ReviewErrorCode = keyof typeof reviewErrorMessages;

export function getReviewNoticeMessage(code: string | undefined | null) {
  if (!code) {
    return null;
  }

  if (Object.hasOwn(reviewNoticeMessages, code)) {
    return reviewNoticeMessages[code as ReviewNoticeCode];
  }

  return null;
}

export function getReviewErrorMessage(code: string | undefined | null) {
  if (!code) {
    return null;
  }

  if (Object.hasOwn(reviewErrorMessages, code)) {
    return reviewErrorMessages[code as ReviewErrorCode];
  }

  return null;
}