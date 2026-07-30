import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },

    budgetQuation: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },

    quoteStatus: {
      type: String,
      enum: ['pending', 'shortlisted', 'accepted', 'rejected'],
      default: 'pending',
    },

    availableBrand: {
      type: String,
      default: '',
    },

    earliestDeliveryDate: {
      type: Date,
    },

    sellerType: {
      type: String,
      default: '',
    },

    priceBasis: {
      type: String,
      default: '',
    },

    taxes: {
      type: String,
      default: '',
    },

    // Whether `budgetQuation` already includes the `taxes` GST rate, or
    // GST is added on top of it. Additive/optional -- older bids default
    // to false (exclusive), matching how the price was always presented
    // before this field existed (a raw amount with no inclusive/exclusive
    // treatment implied).
    gstInclusive: {
      type: Boolean,
      default: false,
    },

    freightTerms: {
      type: String,
      default: '',
    },

    paymentTerms: {
      type: String,
      default: '',
    },

    location: {
      type: String,
      default: '',
    },

    buyerNote: {
      type: String,
      default: '',
    },

    // Seller-uploaded quotation file (used by the document-upload quote flow)
    quoteDocument: {
      type: String,
      default: '',
    },

    businessType: {
      type: String,
      enum: ['individual', 'business'],
    },

    businessDets: {
      company_name: { type: String, default: '' },
      company_reg_num: { type: String, default: '' },
      gst_num: { type: String, default: '' },
    },

    // Per-material quote lines, mirroring Product.items[] on the requirement
    // being quoted. Optional/empty on older bids and on single-item or
    // document-upload RFQs where there's nothing to break down — budgetQuation
    // remains the source of truth for the total either way. Added so a quote
    // on a multi-material RFQ can carry a real per-item breakdown instead of
    // collapsing into one lump sum (previously computed client-side and
    // discarded before reaching the server).
    items: [
      {
        // References the specific Product.items[]._id this line responds to.
        // Not `required` -- a bid on a single-item (non-multiple) Product has
        // no productItemId to point at, since that Product has no items[].
        productItemId: { type: mongoose.Schema.Types.ObjectId },
        offeredBrand: { type: String, default: '' },
        unitPrice: { type: Number },
        availability: {
          type: String,
          enum: ['in_stock', 'lead_time', 'unavailable'],
          default: 'in_stock',
        },
        remarks: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

bidSchema.index({ sellerId: 1, buyerId: 1, productId: 1 }, { unique: true });

export default mongoose.model('Bid', bidSchema);
