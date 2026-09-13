from fastapi import APIRouter, HTTPException, Depends
from backend.app.models.schemas import AiFarmerQueryRequest, AiFarmerQueryResponse
from backend.app.services.gemini_service import gemini_service
from backend.app.auth.jwt_handler import get_optional_current_user

router = APIRouter(prefix="/api/ai", tags=["ai"])

@router.post("/farmer-query", response_model=AiFarmerQueryResponse)
async def ask_farmq_ai(
    req: AiFarmerQueryRequest,
    current_user: dict = Depends(get_optional_current_user)
):
    """
    Grounded Agricultural AI Assistant:
    Accepts queries such as:
    - 'What is today's wheat price near me?'
    - 'Should I sell wheat now?'
    - 'Which nearby mandi has better prices?'
    - 'What is the price trend of rice?'

    Enforces strict grounding: Gemini AI never invents or hallucinates fake prices.
    If market data is unavailable, it returns a transparent notice.
    """
    state = req.state or (current_user.get("state") if current_user else None)
    district = req.district or (current_user.get("district") if current_user else None)

    res = await gemini_service.answer_farmer_query(
        query=req.query,
        state=state,
        district=district,
        crop=req.crop
    )
    return AiFarmerQueryResponse(
        answer=res["answer"],
        cropDetected=res.get("cropDetected"),
        verifiedPrices=res.get("verifiedPrices", []),
        confidence=res.get("confidence", "high")
    )
